import json

def lambda_handler(event, context):
    email = event['request']['userAttributes']['email']
    
    allowed_domains = ["g.rit.edu", "rit.edu"]
    
    if "@" in email:
        domain = email.split("@")[-1]
        if domain in allowed_domains:
            # event["response"]["autoConfirmUser"] = True
            # event["response"]["autoVerifyEmail"] = True
            return event

    raise Exception("Signup is restricted to RIT email domains")