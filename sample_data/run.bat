python autoscaling_test.py ^
  --api-url "https://xl0sfjnho3.execute-api.us-east-1.amazonaws.com/" ^
  --token   "your-cognito-jwt-token" ^
  --cluster "app-name-environment-ecs-cluster" ^
  --service "app-name-environment-service" ^
  --region  "us-east-1" ^
  --duration 15 ^
  --users    30 ^
  --cpu-target 70
pause