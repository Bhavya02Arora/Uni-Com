# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory to /app
WORKDIR /app

# Install system dependencies (added curl here)
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download the AWS RDS global trust store
RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Copy the requirements into the container at /app
COPY requirements.txt /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app files to the container
COPY . /app

# Expose the port the app runs on
EXPOSE 8080

# Run app.py when the container launches
# CMD ["python", "main.py"]
CMD ["sh", "-c", "echo \"$PRIVATE_KEY_DATA\" > private_key.pem && python app.py"]
