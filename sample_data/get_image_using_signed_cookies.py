import os
import requests

# Step 1: Get signed cookies
API_URL = "https://k6c9agfv9b.execute-api.us-east-1.amazonaws.com/api/signedcookie"  # Your backend URL
CLOUDFRONT_IMAGE_URL = "https://d361ivok55v72m.cloudfront.net/published/post_67e86eb1da982ff90fe7ccf4/image_1.jpg"

response = requests.get(API_URL, headers={
    "Authorization": f"Bearer {os.getenv('ID_TOKEN')}"  # Replace with your actual JWT token
})

if response.status_code != 200:
    print("Failed to get signed cookies:", response.text)
    exit()

cookies = response.json()
print("Signed cookies received.")

# Prepare the cookie jar
cookie_jar = {
    "CloudFront-Policy": cookies["CloudFront-Policy"],
    "CloudFront-Signature": cookies["CloudFront-Signature"],
    "CloudFront-Key-Pair-Id": cookies["CloudFront-Key-Pair-Id"]
}

for k, v in cookie_jar.items():
    print(f"{k} = {v[:30]}... ({len(v)} chars)")

image_response = requests.get(CLOUDFRONT_IMAGE_URL, cookies=cookie_jar)

if image_response.status_code == 200:
    with open("downloaded_image.jpg", "wb") as f:
        f.write(image_response.content)
    print("Image downloaded successfully.")
else:
    print("Failed to download image:", image_response.status_code, image_response.text)
