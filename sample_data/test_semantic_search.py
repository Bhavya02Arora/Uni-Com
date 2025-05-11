import requests

API_URL = "https://7pok9ttkwb.execute-api.us-east-1.amazonaws.com/api/posts/semanticsearch"  # Update if deployed elsewhere
JWT_TOKEN = "eyJraWQiOiIwdkxUR3FoajJ2a2lucXQxbHpjMTJselBHR2IranBcL1BGM3JSOWZVWlBqRT0iLCJhbGciOiJSUzI1NiJ9.eyJhdF9oYXNoIjoiSzlCcVZaMm9oOUxnNlRTZEF6d0xhdyIsInN1YiI6IjA0MDhhNDg4LTAwMTEtNzA2OS0wODgzLTk1ZWEyODAzYTc4ZSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9aU01jcFZVcUEiLCJjb2duaXRvOnVzZXJuYW1lIjoiMDQwOGE0ODgtMDAxMS03MDY5LTA4ODMtOTVlYTI4MDNhNzhlIiwiYXVkIjoiNmxqYjhvYWkzOXNndjZrNnZndW8wYW00YTgiLCJldmVudF9pZCI6ImJhMzMxYzg5LTQ0MjItNGI5OS1iM2YwLWJlYWFiMWIyNTBmZiIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzQ1MTYyNTczLCJleHAiOjE3NDUyNDg5NzMsImlhdCI6MTc0NTE2MjU3MywianRpIjoiMWQ5NjEwZTgtMzE1MS00MTVmLThkMjAtOTcxNDgzZWEwM2U5IiwiZW1haWwiOiJqcDk5NTlAZy5yaXQuZWR1In0.Vb6OiDDnJZcil9WRs9Z3ivS5cJFNBwKt2OWUXQaJv54oKGo2rUFjWwXIKIq0S08A3tU1pbP15AHkS2zA8-K3rSAKUY8W-xOZ4IWllX3SKYgO39n4NpmFUEPaJN0PGP0BqHDfUL-CFQG27VCXA6yArpU6hfhxWPGdJXDNwPZkp6P7Tha1HSLL4N7jOs9sKYOswJJqCXUYcjerG9ucqWCOqOZSMYRVwKtmJWFM84mFh39llwhuGoLh24ftLOtzmb3f8fx4U04GIJfHabk9o1sdutvQrmSwfrrRYfUpOeT2ulV3SvjB_r_iHWFgvkscocAzogg2i1fanMpu6mpd3zYUCA"  # Replace with a valid token

def test_semantic_search(query: str):
    headers = {
        "Authorization": f"Bearer {JWT_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "query": query
    }

    response = requests.post(API_URL, json=payload, headers=headers)

    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        if response.status_code == 200:
            print("\nTop Posts (by semantic similarity):")
            for i, post in enumerate(data, start=1):
                print(f"{i}. Title: {post.get('title')}, Description: {post.get('description')}")
        else:
            print("Error:", data)
    except Exception as e:
        print("Failed to parse JSON response:", e)
        print("Raw response:", response.text)

if __name__ == "__main__":
    test_semantic_search("Searching for an apartment starting from 21st April")
