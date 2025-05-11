API_URL = "https://hj6ixh9aba.execute-api.us-east-1.amazonaws.com/api/posts"
JWT_TOKEN = "eyJraWQiOiJxUDBWQmplM2RRY1hTWGJBczJPdEgzeEJQKzhvbkdcLzFoTVpkZVo0dlRGaz0iLCJhbGciOiJSUzI1NiJ9.eyJhdF9oYXNoIjoiQ0hndHllU1dMN2xtaEVvLVZyR1FYdyIsInN1YiI6IjI0ZThjNDc4LWQwMjEtNzA1Yy0xMzgyLTBmYjgzYjEzY2ZmZSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9WWllmaUo5a2oiLCJjb2duaXRvOnVzZXJuYW1lIjoiMjRlOGM0NzgtZDAyMS03MDVjLTEzODItMGZiODNiMTNjZmZlIiwiYXVkIjoiN203ZGtncTIyaHZrMTJxMjdjaDdqdjJscGUiLCJldmVudF9pZCI6ImQ2ZjFkZDM0LWQ5NWQtNGIzMi04NmIyLWZjZTNlNjNmN2M5NSIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzQ1MTg5ODAyLCJleHAiOjE3NDUyNzYyMDIsImlhdCI6MTc0NTE4OTgwMiwianRpIjoiNjQ4NWFmOTQtNGVhNi00YTFjLThkMmEtYzNjYjAxNGYyZjY5IiwiZW1haWwiOiJqcDk5NTlAZy5yaXQuZWR1In0.ju1IkVoYA-8AGwD3-At6VC8TXft-I0aUn8wGZOa0JOzMX68dG38kQur5KybyY4UW1qjH6ELij84FVr47Li9H6oeVL8k-YS8uWrDIyf_0wKxv2VLNAq5yfUpNRkoFgS4zmoczfraX_iiT72zuDoXfqrsOppoHLL9EsHVqC-BKCj7LKI31MS0peLjmMIsKHKMQ0eSRBtBkT5VzxcxJDzJ77aCtfDW7pGYApDp1D_3AikAp0hrxf06IejkEAeIA0H5c77VL2_wbLl1Fm_c_KmoKctuKa8eD-RbvrrxXAEoz_Wxs_5r6qcTk65oZFGIVSUGH7nfRBcb7Yevuuh9pl2OHqg"  # Replace with a valid token

import requests
import concurrent.futures
import time

CONCURRENCY = 100

def fetch_posts(page):
    params = {"page": 1, "limit": 150}
    headers = {"Authorization": f"Bearer {JWT_TOKEN}"}
    try:
        response = requests.get(API_URL, headers=headers, params=params, timeout=10)
        if response.status_code != 200:
            print(f"[{page}] Error {response.status_code}: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"[{page}] Request failed: {e}")

if __name__ == "__main__":
    print("🚀 Starting constant-load test with 100 concurrent threads...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = set()
        page_counter = 1

        while True:
            # Remove completed futures
            done, futures = concurrent.futures.wait(
                futures, timeout=0, return_when=concurrent.futures.FIRST_COMPLETED
            )
            for future in done:
                futures.discard(future)

            # If there is capacity, submit more
            if len(futures) < CONCURRENCY:
                future = executor.submit(fetch_posts, page_counter)
                futures.add(future)
                page_counter += 1

            # Slight pause to prevent CPU burn
            time.sleep(0.001)
