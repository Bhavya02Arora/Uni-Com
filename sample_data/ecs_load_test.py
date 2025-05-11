#!/usr/bin/env python3
import requests
import time
import json
import random
import concurrent.futures
import argparse
import matplotlib.pyplot as plt
from datetime import datetime
import boto3
import numpy as np
from tqdm import tqdm

class ECSAutoscalingTest:
    def __init__(self, api_url, cognito_token, region='us-east-1'):
        self.api_url = api_url.rstrip('/')
        self.token = cognito_token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        })
        self.cloudwatch = boto3.client('cloudwatch', region_name=region)
        self.ecs = boto3.client('ecs', region_name=region)
        
        # Test the connection
        try:
            resp = self.session.get(f"{self.api_url}/health")
            if resp.status_code != 200:
                print(f"Failed to connect to API: {resp.status_code} - {resp.text}")
                exit(1)
            print(f"Successfully connected to API: {resp.json()}")
        except Exception as e:
            print(f"Failed to connect to API: {e}")
            exit(1)
    
    def get_cluster_info(self, cluster_name):
        """Get current ECS cluster status"""
        services = self.ecs.list_services(cluster=cluster_name)
        service_details = []
        
        for service_arn in services['serviceArns']:
            service_name = service_arn.split('/')[-1]
            service = self.ecs.describe_services(
                cluster=cluster_name,
                services=[service_name]
            )['services'][0]
            
            service_details.append({
                'name': service_name,
                'desiredCount': service['desiredCount'],
                'runningCount': service['runningCount'],
                'pendingCount': service['pendingCount']
            })
        
        return service_details
    
    def get_metrics(self, cluster_name, service_name, start_time, end_time):
        """Get CPU and memory metrics for the ECS service"""
        metrics = []
        
        for metric_name in ['CPUUtilization', 'MemoryUtilization']:
            response = self.cloudwatch.get_metric_statistics(
                Namespace='AWS/ECS',
                MetricName=metric_name,
                Dimensions=[
                    {'Name': 'ClusterName', 'Value': cluster_name},
                    {'Name': 'ServiceName', 'Value': service_name}
                ],
                StartTime=start_time,
                EndTime=end_time,
                Period=60,  # 1-minute periods
                Statistics=['Average']
            )
            
            datapoints = response['Datapoints']
            datapoints.sort(key=lambda x: x['Timestamp'])
            
            metrics.append({
                'name': metric_name,
                'timestamps': [dp['Timestamp'] for dp in datapoints],
                'values': [dp['Average'] for dp in datapoints]
            })
        
        return metrics
    
    def create_post(self):
        """Create a post with random content to generate load"""
        categories = ['ROOMMATE', 'SELL', 'CARPOOL']
        category = random.choice(categories)
        
        post_data = {
            "title": f"Test Post {time.time()}",
            "description": f"This is a test post created at {datetime.now().isoformat()} to test autoscaling capabilities. " * 5,
            "category": category
        }
        
        # Add category-specific fields
        if category == 'ROOMMATE':
            post_data.update({
                "community": "Test Community",
                "rent": random.uniform(500, 2000),
                "start_date": (datetime.now().isoformat().split('T')[0])
            })
        elif category == 'SELL':
            post_data.update({
                "price": random.uniform(10, 500),
                "item": "Test Item",
                "sub_category": "ELECTRONICS"
            })
        elif category == 'CARPOOL':
            post_data.update({
                "from_location": "Test Origin",
                "to_location": "Test Destination",
                "departure_time": datetime.now().isoformat(),
                "seats_available": random.randint(1, 4)
            })
        
        try:
            response = self.session.post(f"{self.api_url}/api/posts", json=post_data)
            return response.status_code == 202
        except Exception as e:
            print(f"Error creating post: {e}")
            return False
    
    def semantic_search(self):
        """Perform a semantic search query to generate CPU load"""
        queries = [
            "Looking for a roommate near campus",
            "Need to sell my laptop",
            "Anyone driving to the city this weekend?",
            "Furniture for sale",
            "Apartment available starting next month"
        ]
        
        try:
            response = self.session.post(
                f"{self.api_url}/api/posts/semanticsearch", 
                json={"query": random.choice(queries)}
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error in semantic search: {e}")
            return False
    
    def get_all_posts(self):
        """Retrieve posts with different query parameters"""
        params = {
            'page': random.randint(1, 3),
            'limit': random.randint(5, 20),
            'sort': random.choice(['asc', 'desc'])
        }
        
        # Randomly add category filter
        if random.random() > 0.5:
            params['category'] = random.choice(['ROOMMATE', 'SELL', 'CARPOOL'])
        
        # Randomly add search term
        if random.random() > 0.7:
            search_terms = ["room", "sale", "cheap", "available", "new"]
            params['search'] = random.choice(search_terms)
            
        try:
            response = self.session.get(f"{self.api_url}/api/posts", params=params)
            return response.status_code == 200
        except Exception as e:
            print(f"Error getting posts: {e}")
            return False
    
    def run_load_test(self, cluster_name, service_name, duration_minutes=10, 
                      users=10, ramp_up=True, cpu_target=80):
        """
        Run a load test with the given parameters
        
        Args:
            cluster_name: ECS cluster name
            service_name: ECS service name
            duration_minutes: Test duration in minutes
            users: Maximum number of concurrent users
            ramp_up: Whether to gradually increase load
            cpu_target: Target CPU utilization percentage
        """
        print(f"\n{'=' * 80}")
        print(f"Starting load test with {users} concurrent users for {duration_minutes} minutes")
        print(f"Target CPU: {cpu_target}%")
        print(f"{'=' * 80}\n")
        
        # Record start time for metrics
        start_time = datetime.now()
        
        # Get initial service details
        initial_details = self.get_cluster_info(cluster_name)
        for service in initial_details:
            if service['name'] == service_name:
                initial_count = service['desiredCount']
                print(f"Initial service count: {initial_count} tasks")
        
        # Initialize counters
        successful_requests = 0
        failed_requests = 0
        request_times = []
        
        # Calculate total duration in seconds
        total_duration = duration_minutes * 60
        end_time = time.time() + total_duration
        
        with tqdm(total=total_duration, desc="Running test") as pbar:
            while time.time() < end_time:
                current_time = time.time()
                elapsed_time = current_time - (end_time - total_duration)
                
                # Calculate current concurrent users based on ramp up/down pattern
                if ramp_up:
                    # Ramp up to peak in 1/4 of the time, sustain for 1/2, ramp down for 1/4
                    if elapsed_time < total_duration / 4:
                        # Ramp up phase
                        current_users = int(users * (elapsed_time / (total_duration / 4)))
                    elif elapsed_time > total_duration * 3 / 4:
                        # Ramp down phase
                        current_users = int(users * (1 - (elapsed_time - total_duration * 3 / 4) / (total_duration / 4)))
                    else:
                        # Sustained load phase
                        current_users = users
                else:
                    current_users = users
                
                current_users = max(1, current_users)  # Ensure at least 1 user
                
                # Run concurrent requests
                with concurrent.futures.ThreadPoolExecutor(max_workers=current_users) as executor:
                    futures = []
                    
                    # Mix of API calls to generate load
                    for _ in range(current_users):
                        action = random.random()
                        if action < 0.3:  # 30% create posts
                            futures.append(executor.submit(self.create_post))
                        elif action < 0.7:  # 40% get posts
                            futures.append(executor.submit(self.get_all_posts))
                        else:  # 30% semantic search (most CPU intensive)
                            futures.append(executor.submit(self.semantic_search))
                    
                    # Process results
                    for future in concurrent.futures.as_completed(futures):
                        try:
                            if future.result():
                                successful_requests += 1
                            else:
                                failed_requests += 1
                        except Exception as e:
                            print(f"Request error: {e}")
                            failed_requests += 1
                
                # Sleep for a short time to avoid overwhelming API
                time.sleep(0.5)
                
                # Update progress bar
                elapsed = min(time.time() - (end_time - total_duration), total_duration)
                pbar.update(elapsed - pbar.n)
                
                # Periodically check service status
                if int(elapsed) % 60 == 0 and int(elapsed) > 0:
                    service_details = self.get_cluster_info(cluster_name)
                    for service in service_details:
                        if service['name'] == service_name:
                            current_count = service['desiredCount']
                            print(f"\nCurrent service count: {current_count} tasks (was {initial_count})")
                            if current_count > initial_count:
                                print("Autoscaling has triggered! ⬆️")
        
        print("\nLoad test complete!")
        print(f"Successful requests: {successful_requests}")
        print(f"Failed requests: {failed_requests}")
        success_rate = successful_requests / (successful_requests + failed_requests) * 100 if (successful_requests + failed_requests) > 0 else 0
        print(f"Success rate: {success_rate:.2f}%")
        
        # Wait a bit for CloudWatch metrics to be updated
        print("\nWaiting 2 minutes for metrics to be updated...")
        time.sleep(120)
        
        # Get final service details
        final_details = self.get_cluster_info(cluster_name)
        for service in final_details:
            if service['name'] == service_name:
                final_count = service['desiredCount']
                print(f"Final service count: {final_count} tasks")
                if final_count > initial_count:
                    print(f"Autoscaling increased tasks by {final_count - initial_count} (from {initial_count} to {final_count})")
        
        # Get and plot metrics
        end_metric_time = datetime.now()
        metrics = self.get_metrics(cluster_name, service_name, start_time, end_metric_time)
        
        self.plot_metrics(metrics, initial_count, cpu_target)
        
        print("\nTest summary:")
        print(f"Duration: {duration_minutes} minutes")
        print(f"Concurrent users: {users}")
        print(f"Total requests: {successful_requests + failed_requests}")
        print(f"Success rate: {success_rate:.2f}%")
        print(f"Initial task count: {initial_count}")
        print(f"Final task count: {final_count}")
        
        return {
            'initial_count': initial_count,
            'final_count': final_count,
            'successful_requests': successful_requests,
            'failed_requests': failed_requests,
            'success_rate': success_rate,
            'metrics': metrics
        }
    
    def plot_metrics(self, metrics, initial_count, target_cpu):
        """Plot CloudWatch metrics from the test"""
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
        
        # Plot CPU utilization
        cpu_metric = next((m for m in metrics if m['name'] == 'CPUUtilization'), None)
        if cpu_metric and cpu_metric['timestamps']:
            ax1.plot(cpu_metric['timestamps'], cpu_metric['values'], 'b-', label='CPU Utilization')
            ax1.axhline(y=target_cpu, color='r', linestyle='--', label=f'Target ({target_cpu}%)')
            ax1.set_title('ECS Service CPU Utilization')
            ax1.set_ylabel('CPU Utilization %')
            ax1.set_ylim(0, max(max(cpu_metric['values']) * 1.1, target_cpu * 1.1, 100))
            ax1.legend()
            ax1.grid(True)
        else:
            ax1.text(0.5, 0.5, 'No CPU data available', horizontalalignment='center', verticalalignment='center')
        
        # Plot Memory utilization
        mem_metric = next((m for m in metrics if m['name'] == 'MemoryUtilization'), None)
        if mem_metric and mem_metric['timestamps']:
            ax2.plot(mem_metric['timestamps'], mem_metric['values'], 'g-', label='Memory Utilization')
            ax2.set_title('ECS Service Memory Utilization')
            ax2.set_xlabel('Time')
            ax2.set_ylabel('Memory Utilization %')
            ax2.set_ylim(0, max(max(mem_metric['values']) * 1.1, 100))
            ax2.legend()
            ax2.grid(True)
        else:
            ax2.text(0.5, 0.5, 'No memory data available', horizontalalignment='center', verticalalignment='center')
        
        plt.tight_layout()
        plt.savefig('autoscaling_test_results.png')
        print("Saved metrics plot to autoscaling_test_results.png")
        plt.show()


def main():
    parser = argparse.ArgumentParser(description='Test ECS autoscaling with simulated load')
    parser.add_argument('--api-url', required=True, help='Base URL of the API (e.g., https://api.example.com)')
    parser.add_argument('--token', required=True, help='Cognito JWT token for authentication')
    parser.add_argument('--cluster', required=True, help='ECS cluster name')
    parser.add_argument('--service', required=True, help='ECS service name')
    parser.add_argument('--region', default='us-east-1', help='AWS region')
    parser.add_argument('--duration', type=int, default=10, help='Test duration in minutes')
    parser.add_argument('--users', type=int, default=20, help='Max concurrent users')
    parser.add_argument('--cpu-target', type=int, default=70, help='Target CPU percentage')
    parser.add_argument('--no-ramp', action='store_false', dest='ramp_up', help='Disable load ramping')
    
    args = parser.parse_args()
    
    tester = ECSAutoscalingTest(args.api_url, args.token, args.region)
    
    # Run the load test
    result = tester.run_load_test(
        cluster_name=args.cluster,
        service_name=args.service,
        duration_minutes=args.duration,
        users=args.users,
        ramp_up=args.ramp_up,
        cpu_target=args.cpu_target
    )


if __name__ == "__main__":
    main()