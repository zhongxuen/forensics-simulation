import type { GlossaryEntry, GlossaryEntryInput } from "./schemas/glossary";

/**
 * The glossary: every term the Learning Center and cases define with <Term>
 * (md-files/09-learning-center.md, prompt 09.3).
 *
 * Writing rules, checked by tests/unit/glossary.test.ts:
 * - `short` is one sentence a complete beginner understands. It may not use another entry's term
 *   unless that entry is marked `everyday`, and it may not contain an acronym except the entry's
 *   own. It stands alone in the hover card, so it can't lean on anything around it.
 * - `long` adds how it works, an example, and where the learner meets it. It may use other terms.
 * - No banned words (md-files/voice-and-tone.md). Keep examples fictional: `example.com` domains,
 *   `10.x` and `192.168.x` addresses.
 * - Wrap commands, file names and addresses in backticks. They render in code font.
 *
 * `relatedLessons` names up to three of this site's lessons that define the term, gentlest first.
 * The entries vendored from Hacker Simulation had theirs removed, since those lessons live on the
 * other site (docs/plan/13-learning-center.md). The cross-reference test
 * (tests/unit/content-references.test.ts) fails on a lesson id that doesn't resolve.
 */
const ENTRIES: readonly GlossaryEntryInput[] = [
  // Foundations: the basics, security fundamentals, ethics and law.
  {
    id: "hacker",
    term: "Hacker",
    topic: "foundations",
    everyday: true,
    short: "Someone who understands computers well enough to make them do unexpected things.",
    long: "The word started out meaning a curious tinkerer, and plenty of hackers use their skills to protect people. News stories tend to use it for criminals, which is why security people say white hat or black hat to make the difference clear.",
    relatedTerms: ["white-hat", "black-hat", "ethical-hacking"],
  },
  {
    id: "ethical-hacking",
    term: "Ethical hacking",
    topic: "foundations",
    short:
      "Testing how well a computer system is protected, with the owner's permission, so weak spots get fixed before criminals find them.",
    long: "Ethical hackers use the same ideas as criminals, but they only work on systems they have written permission to test, and they report everything they find to the owner. That permission is the whole difference: the same action is a job with it and a crime without it.",
    relatedTerms: ["authorization", "scope", "penetration-test", "white-hat"],
  },
  {
    id: "white-hat",
    term: "White hat",
    topic: "foundations",
    short:
      "A hacker who works to protect people and only tests systems they have permission to test.",
    long: "The name comes from old cowboy films, where the heroes wore white hats. Your team in Hacker Simulation is a white-hat team: every job starts with the client's written permission.",
    relatedTerms: ["black-hat", "ethical-hacking", "hacker"],
  },
  {
    id: "black-hat",
    term: "Black hat",
    topic: "foundations",
    short:
      "A hacker who breaks into computers without permission, usually to steal, spy or cause harm.",
    long: "Black-hat hackers are criminals. Studying how they work is how defenders learn to stop them, which is why you'll see their tricks in missions, always practised on computers your team is allowed to test.",
    relatedTerms: ["white-hat", "hacker", "threat"],
  },
  {
    id: "authorization",
    term: "Authorization",
    topic: "foundations",
    short: "Clear permission, usually in writing, from the owner of a system to test it.",
    long: "Before any security test, the owner signs a document saying who may test what, how, and when. Testing without it is a crime in most countries, even with good intentions. In other settings, authorization also means what an account is allowed to do once it has logged in.",
    relatedTerms: ["scope", "rules-of-engagement", "ethical-hacking", "authentication"],
    relatedLessons: ["foundations-what-forensics-is"],
  },
  {
    id: "scope",
    term: "Scope",
    topic: "foundations",
    short: "The agreed list of which systems you may test, how, and when.",
    long: "Anything outside the scope is off limits, even if it's on the same network and even if it looks weak. If you find something interesting outside the scope, you stop and ask the owner, and you don't test it.",
    relatedTerms: ["authorization", "rules-of-engagement"],
    relatedLessons: ["foundations-what-forensics-is"],
  },
  {
    id: "rules-of-engagement",
    term: "Rules of engagement",
    topic: "foundations",
    short:
      "The written ground rules for a security test: what's allowed, what's off limits, and who to call if something goes badly.",
    long: "Rules of engagement cover things like testing hours, which techniques are allowed, and how to report something urgent. Your first mission, Welcome to the Team, walks you through them.",
    relatedTerms: ["scope", "authorization", "penetration-test"],
  },
  {
    id: "responsible-disclosure",
    term: "Responsible disclosure",
    topic: "foundations",
    short:
      "Telling a system's owner privately about a weakness you found, and giving them time to fix it before anyone else hears about it.",
    long: "Announcing a weakness publicly before it's fixed hands criminals a map. Many organisations publish how they want to be told about problems, and some reward people who report them.",
    relatedTerms: ["vulnerability", "ethical-hacking"],
  },
  {
    id: "vulnerability",
    term: "Vulnerability",
    topic: "foundations",
    short:
      "A weak spot in a computer system that someone could use to do something they shouldn't be able to.",
    long: "It could be a bug in a program, a setting left open, or a password that's too short. Finding vulnerabilities before criminals do, and getting them fixed, is most of what a security team does.",
    relatedTerms: ["exploit", "patch", "threat", "risk"],
  },
  {
    id: "exploit",
    term: "Exploit",
    topic: "foundations",
    short: "A method or piece of code that takes advantage of a weak spot in a system.",
    long: "A vulnerability is the unlocked window. An exploit is the way through it. Hacker Simulation never gives you real exploit code: missions show what an exploit does inside the simulation, and how to defend against it.",
    relatedTerms: ["vulnerability", "patch"],
  },
  {
    id: "threat",
    term: "Threat",
    topic: "foundations",
    short: "Anyone or anything that could harm a system or the people who rely on it.",
    long: "A threat can be a criminal group, an unhappy former employee, or even a flood in the server room. Security teams ask which threats are most likely, so they spend their effort where it matters.",
    relatedTerms: ["risk", "threat-modelling", "vulnerability"],
  },
  {
    id: "risk",
    term: "Risk",
    topic: "foundations",
    short: "How likely something bad is to happen, combined with how much damage it would do.",
    long: "A weakness anyone can reach, guarding customer data, is a high risk. A weakness buried deep in a test machine with nothing on it is a low one. Teams fix the highest risks first.",
    relatedTerms: ["threat", "vulnerability"],
  },
  {
    id: "attack-surface",
    term: "Attack surface",
    topic: "foundations",
    short: "All the places where an attacker could try to get into a system.",
    long: "Every open port, login page, email inbox and forgotten test server adds to the attack surface. Switching off what nobody uses is one of the cheapest defences there is, because it removes doors instead of guarding them.",
    relatedTerms: ["port", "hardening", "vulnerability"],
  },
  {
    id: "cia-triad",
    term: "CIA triad",
    aka: ["CIA"],
    topic: "foundations",
    short:
      "The three things security protects: keeping secrets secret, keeping information accurate, and keeping systems working.",
    long: "The letters stand for confidentiality, integrity and availability. It has nothing to do with spies. When you judge how bad a problem is, ask which of the three it breaks.",
    relatedTerms: ["confidentiality", "integrity", "availability"],
  },
  {
    id: "confidentiality",
    term: "Confidentiality",
    topic: "foundations",
    short: "Making sure only the right people can see a piece of information.",
    long: "A leaked customer list breaks confidentiality. Passwords, encryption and file permissions all exist to protect it.",
    relatedTerms: ["cia-triad", "encryption", "permissions"],
  },
  {
    id: "integrity",
    term: "Integrity",
    topic: "foundations",
    short:
      "Making sure information stays accurate, and that nobody can change it without it being noticed.",
    long: "Someone quietly changing the bank details on an invoice breaks integrity. Hashes are one way to check that a file hasn't been changed.",
    relatedTerms: ["cia-triad", "hash"],
    relatedLessons: ["foundations-hashing-for-evidence"],
  },
  {
    id: "availability",
    term: "Availability",
    topic: "foundations",
    short:
      "Making sure systems and information are there when the people who need them go to use them.",
    long: "A website knocked offline, or files locked by ransomware, breaks availability. Backups and spare equipment help protect it.",
    relatedTerms: ["cia-triad", "backup", "ransomware"],
  },
  {
    id: "least-privilege",
    term: "Least privilege",
    topic: "foundations",
    short:
      "Giving each person or program only the access it needs to do its job, and nothing more.",
    long: "If the account that runs a website can't read the payroll files, a break-in through the website can't reach the payroll either. It's why you don't use the root account for everyday work.",
    relatedTerms: ["permissions", "root", "defence-in-depth"],
  },
  {
    id: "defence-in-depth",
    term: "Defence in depth",
    topic: "foundations",
    short:
      "Protecting something with several layers of security, so one failure doesn't let an attacker all the way in.",
    long: "Think of a castle: a moat, then a wall, then guards, then a locked vault. On a network the layers might be a firewall, strong passwords, careful permissions and someone watching the logs.",
    relatedTerms: ["firewall", "least-privilege", "network-segmentation"],
  },
  {
    id: "threat-modelling",
    term: "Threat modelling",
    topic: "foundations",
    short:
      "Thinking through who might attack a system, what they'd want, and how they might try, so you know what to protect first.",
    long: "A threat model for a small bakery looks very different from one for a bank. The questions stay the same: what are we protecting, from whom, and what happens if we fail?",
    relatedTerms: ["threat", "risk", "attack-surface"],
  },
  {
    id: "authentication",
    term: "Authentication",
    topic: "foundations",
    short: "Proving who you are to a computer, usually with a password.",
    long: 'Logging in is authentication. It answers the question "who are you?". What you\'re allowed to do afterwards is a separate question, called authorization. Adding a second kind of proof, like a code on your phone, makes authentication much stronger.',
    relatedTerms: ["password", "credentials", "multi-factor-authentication", "authorization"],
  },
  {
    id: "social-engineering",
    term: "Social engineering",
    topic: "foundations",
    short: "Tricking people, rather than computers, into giving away information or access.",
    long: "A phone call pretending to be the help desk, a fake delivery email, someone following staff through a locked door: it's often easier to fool a person than to break a lock. Training people to pause and check is one of the best defences.",
    relatedTerms: ["phishing"],
  },
  {
    id: "phishing",
    term: "Phishing",
    topic: "foundations",
    short:
      "A fake message, often an email, that tries to trick you into clicking a link, opening a file or typing a password.",
    long: "Phishing messages often pretend to be from a bank, a delivery company or your own boss, and they try to make you hurry. Checking the real sender and the real web address before you click catches most of them.",
    relatedTerms: ["social-engineering", "malware", "url"],
  },
  {
    id: "malware",
    term: "Malware",
    topic: "foundations",
    short: "Software written to cause harm, like stealing information or locking up files.",
    long: "The name is short for malicious software. Viruses, spyware and ransomware are all kinds of malware. Missions in Hacker Simulation study the traces malware leaves behind, never real samples.",
    relatedTerms: ["ransomware", "phishing", "indicator-of-compromise"],
  },
  {
    id: "penetration-test",
    term: "Penetration test",
    aka: ["pen test", "pentest"],
    topic: "foundations",
    short:
      "A hired, permitted attempt to break into a system to find weak spots before criminals do.",
    long: "A penetration test always starts with authorization and an agreed scope, and ends with a report that explains every weakness found and how to fix it. Most of your team's jobs in the story are penetration tests.",
    relatedTerms: ["ethical-hacking", "scope", "rules-of-engagement", "red-team"],
  },

  // Linux: files, folders, users and commands.
  {
    id: "operating-system",
    term: "Operating system",
    aka: ["OS"],
    topic: "linux",
    short:
      "The main program that runs a computer and lets every other program use its screen, files and memory.",
    long: "Windows, macOS, Android and Linux are all operating systems. It decides which programs run, which files they can open, and which user is in charge.",
    relatedTerms: ["linux", "process"],
  },
  {
    id: "linux",
    term: "Linux",
    topic: "linux",
    short:
      "A free family of software for running computers, used on most of the machines behind websites.",
    long: "Linux is an operating system, like Windows or macOS. Most servers run it, so security work involves a lot of it. The terminals in Hacker Simulation behave like a Linux computer, but everything in them is simulated.",
    relatedTerms: ["operating-system", "terminal", "shell"],
  },
  {
    id: "terminal",
    term: "Terminal",
    aka: ["command line"],
    topic: "linux",
    short: "A window where you control a computer by typing commands instead of clicking.",
    long: "You type a command, press Enter, and the computer answers with text. It looks old-fashioned, but it's fast, precise and repeatable, which is why security people use it every day. The terminal in this app is simulated: nothing you type reaches a real computer.",
    relatedTerms: ["command", "shell"],
  },
  {
    id: "command",
    term: "Command",
    topic: "linux",
    everyday: true,
    short: "An instruction you type to tell a computer to do something, like listing your files.",
    long: "A command starts with its name, like `ls`, often followed by options (`ls -a`) and things to work on (`ls notes`). Type `man` and a command's name to read its help page.",
    relatedTerms: ["terminal", "shell", "man-page"],
  },
  {
    id: "shell",
    term: "Shell",
    topic: "linux",
    short: "The program that reads the commands you type and carries them out.",
    long: "The terminal is the window. The shell is the program inside it that understands what you type. It's called a shell because it wraps around the operating system, like a shell around a nut.",
    relatedTerms: ["terminal", "command"],
  },
  {
    id: "file",
    term: "File",
    topic: "linux",
    everyday: true,
    short: "A named piece of saved information, like a document, a picture or a program.",
    long: "On Linux, almost everything is a file, even settings and logs. Every file has an owner and permissions that decide who can read or change it.",
    relatedTerms: ["directory", "permissions", "hidden-file"],
  },
  {
    id: "directory",
    term: "Directory",
    topic: "linux",
    short: "Another name for a folder: a place that holds files and other folders.",
    long: "Type `ls` to list what's in the directory you're in, and `cd` followed by a name to move into another one. `cd ..` takes you up one level.",
    relatedTerms: ["file", "path", "file-system", "home-directory"],
  },
  {
    id: "file-system",
    term: "File system",
    aka: ["filesystem"],
    topic: "linux",
    short: "The way a computer organises all its files and folders into one big tree.",
    long: "On Linux the tree starts at the root directory, written `/`. Everything hangs off it: `/home` for people's own folders, `/etc` for settings, `/var/log` for logs.",
    relatedTerms: ["directory", "path", "root-directory"],
  },
  {
    id: "path",
    term: "Path",
    topic: "linux",
    short:
      "The address of a file or folder, written as the folders you pass through to reach it, like `/home/ana/notes.txt`.",
    long: "A path that starts with `/` begins at the very top of the file system, and works from anywhere. A path without it starts from the folder you're in. `.` means the folder you're in and `..` means the one above it.",
    relatedTerms: ["directory", "file-system", "root-directory"],
  },
  {
    id: "home-directory",
    term: "Home directory",
    topic: "linux",
    short:
      "Your own folder on a computer, where your files live and where you start when you log in.",
    long: "On Linux, home directories live under `/home`, so the user ana's is `/home/ana`. The shortcut `~` always means your own home directory.",
    relatedTerms: ["directory", "user-account", "path"],
  },
  {
    id: "root-directory",
    term: "Root directory",
    topic: "linux",
    short:
      "The top folder that every other file and folder on the computer sits inside, written as a single slash.",
    long: "The root directory is `/`. Don't confuse it with the root user, the all-powerful account: they share a name because both sit at the top of something.",
    relatedTerms: ["file-system", "path", "root"],
  },
  {
    id: "root",
    term: "Root",
    aka: ["root user", "superuser"],
    topic: "linux",
    short:
      "The all-powerful admin account on a computer, which can read, change or delete anything.",
    long: "Because root can do anything, a mistake or a break-in as root can do the most damage. Good practice is to work as a normal user and borrow root's powers only when needed, with `sudo`.",
    relatedTerms: ["sudo", "user-account", "least-privilege", "permissions"],
  },
  {
    id: "user-account",
    term: "User account",
    topic: "linux",
    short: "A named identity on a computer, with its own password and its own files.",
    long: "Every program and every file belongs to some account. Type `whoami` to see which account you're using. Services often run as their own accounts, so a problem in one can't reach another's files.",
    relatedTerms: ["user-group", "root", "home-directory", "permissions"],
  },
  {
    id: "user-group",
    term: "User group",
    topic: "linux",
    short: "A named set of accounts on a computer that share the same access to some files.",
    long: "Instead of giving five people access to a folder one by one, you put them in a group and give the group access. Every file on Linux has an owning user and an owning group.",
    relatedTerms: ["user-account", "permissions"],
  },
  {
    id: "permissions",
    term: "Permissions",
    topic: "linux",
    short: "Rules attached to each file that say who may read it, change it or run it.",
    long: 'Linux sets permissions for three kinds of people: the file\'s owner, its group, and everyone else. `ls -l` shows them as letters, like `rw-r-----`: r is read, w is write, x is run. A "permission denied" message means the rules said no, which is often the protection working.',
    relatedTerms: ["user-account", "user-group", "root", "least-privilege"],
  },
  {
    id: "sudo",
    term: "sudo",
    topic: "linux",
    short:
      "A command that runs one other command with admin powers, after checking you're allowed to.",
    long: "Typing `sudo` before a command asks to run it as root. The computer checks a list of who may do that, and usually asks for your password first. It keeps a record of every use, which investigators love.",
    relatedTerms: ["root", "least-privilege"],
  },
  {
    id: "process",
    term: "Process",
    topic: "linux",
    short: "A program that's running right now.",
    long: "Every process runs as some user account and has a number called its process id. Investigators look for processes that shouldn't be there, like an unfamiliar program running as root.",
    relatedTerms: ["operating-system", "user-account"],
    relatedLessons: ["foundations-order-of-volatility"],
  },
  {
    id: "log-file",
    term: "Log file",
    topic: "linux",
    short: "A file where a computer or program writes down what happened and when, line by line.",
    long: "Logs record logins, errors, web requests and much more, usually under `/var/log` on Linux. They're often the first place an investigator looks. In missions, the simulated `logview` command searches them.",
    relatedTerms: ["timestamp", "digital-forensics", "alert"],
  },
  {
    id: "hidden-file",
    term: "Hidden file",
    aka: ["dotfile"],
    topic: "linux",
    short: "A file whose name starts with a dot, so it doesn't show up in a normal file listing.",
    long: "Type `ls -a` to see hidden files too. They're usually settings, not secrets: hiding them only keeps listings tidy. That's also why a real secret should never rely on being hidden.",
    relatedTerms: ["file", "directory"],
  },
  {
    id: "man-page",
    term: "Man page",
    aka: ["manual page"],
    topic: "linux",
    short: "The built-in help page for a command, opened by typing `man` and the command's name.",
    long: "`man ls` explains what `ls` does and lists every option it takes. Reading help pages is a real skill: professionals look things up all the time.",
    relatedTerms: ["command", "terminal"],
  },
  {
    id: "prompt",
    term: "Prompt",
    topic: "linux",
    short:
      "The text at the start of the typing line that says the computer is ready for your next command.",
    long: "In `recruit@range-ws-01:~$`, `recruit` is your account, `range-ws-01` is the computer, `~` is your home folder, and `$` means you're an ordinary account (root gets `#`). The prompt changes as you move between folders, so it always tells you where you are.",
    relatedTerms: ["terminal", "home-directory", "root"],
  },
  {
    id: "command-option",
    term: "Option",
    aka: ["Flag"],
    topic: "linux",
    short:
      "An extra setting you add after a command's name, usually starting with a dash, that changes what it does.",
    long: "`ls` lists files, `ls -l` lists them with details, and `ls -a` includes hidden ones. Options can often be combined, like `ls -la`. A command's manual page lists every option it has.",
    relatedTerms: ["command", "man-page"],
  },

  // Networking: how computers find each other and pass messages.
  {
    id: "network",
    term: "Network",
    topic: "networking",
    everyday: true,
    short: "Two or more computers connected so they can send each other messages.",
    long: "A network can be two laptops on a home wifi, or thousands of machines in an office. The internet is a network of networks.",
    relatedTerms: ["internet", "ip-address", "router"],
  },
  {
    id: "internet",
    term: "Internet",
    topic: "networking",
    everyday: true,
    short: "The worldwide network of networks that links computers everywhere.",
    long: "Your home network connects to the internet through a router. Hacker Simulation never touches the real internet: every network in it is simulated, with made-up addresses.",
    relatedTerms: ["network", "router", "dns"],
  },
  {
    id: "ip-address",
    term: "IP address",
    aka: ["IP"],
    topic: "networking",
    short: "A number that identifies a computer on a network, like a street address for messages.",
    long: "Most IP addresses are written as four numbers from 0 to 255 separated by dots, like `10.0.0.12`. Some ranges, including `10.x.x.x` and `192.168.x.x`, are kept for private networks, which is why the missions use them.",
    relatedTerms: ["subnet", "network", "dns"],
  },
  {
    id: "subnet",
    term: "Subnet",
    aka: ["subnetwork"],
    topic: "networking",
    short: "A smaller slice of a network, made of addresses that all start the same way.",
    long: "`10.0.0.0/24` means every address from `10.0.0.0` to `10.0.0.255`: the `/24` says the first three numbers stay fixed. Offices often put different teams or machines on different subnets, with firewalls between them.",
    relatedTerms: ["ip-address", "network-segmentation", "firewall"],
  },
  {
    id: "port",
    term: "Port",
    topic: "networking",
    short:
      "A numbered door on a computer, where each kind of program waits for messages behind its own number.",
    long: "One computer can run a website on port 80 and remote logins on port 22 at the same time: the port number tells each message which program it's for. An open port is a door something is answering. A network scan checks which doors are open.",
    relatedTerms: ["service", "network-scan", "banner", "firewall"],
  },
  {
    id: "service",
    term: "Service",
    topic: "networking",
    short:
      "A program on a computer that waits for messages from other computers and answers them, like a website or email.",
    long: "Each service listens on a port. Finding which services a computer runs, and which versions, tells you where its weak spots might be. On a machine you're investigating, a service nobody remembers installing is worth a closer look.",
    relatedTerms: ["port", "banner", "server"],
  },
  {
    id: "banner",
    term: "Banner",
    topic: "networking",
    short:
      "The short greeting a program sends when you connect, which often names its software and version.",
    long: "A banner like `FTP server 2.3.4 ready` tells a defender, or an attacker, exactly what's running. Old versions with known weaknesses stand out. Hiding version details in banners is a small but real defence.",
    relatedTerms: ["service", "port", "vulnerability"],
  },
  {
    id: "protocol",
    term: "Protocol",
    topic: "networking",
    short: "An agreed set of rules for how two computers talk, so each understands the other.",
    long: "Like a shared language with strict manners: who speaks first, what each message looks like, how to say goodbye. HTTP, TCP and DNS are all protocols.",
    relatedTerms: ["tcp", "udp", "http"],
  },
  {
    id: "packet",
    term: "Packet",
    topic: "networking",
    short:
      "A small chunk of data sent across a network, because big messages get split into many of them.",
    long: "Each packet carries a label with where it came from and where it's going, like an envelope. The receiving computer puts the pieces back together in order.",
    relatedTerms: ["tcp", "udp", "ip-address"],
  },
  {
    id: "tcp",
    term: "TCP",
    aka: ["Transmission Control Protocol"],
    topic: "networking",
    short:
      "A way of sending data that checks every piece arrives, in order, and sends again anything lost.",
    long: "Websites, email and remote logins use TCP because every byte matters. It starts each conversation with the three-way handshake.",
    relatedTerms: ["udp", "tcp-handshake", "protocol", "port"],
  },
  {
    id: "udp",
    term: "UDP",
    aka: ["User Datagram Protocol"],
    topic: "networking",
    short: "A faster way of sending data that doesn't check whether each piece arrives.",
    long: "Video calls and online games often use UDP, because a late piece of data is useless anyway. DNS lookups use it too, since they're tiny and cheap to ask again.",
    relatedTerms: ["tcp", "protocol", "dns"],
  },
  {
    id: "tcp-handshake",
    term: "Three-way handshake",
    aka: ["TCP handshake"],
    topic: "networking",
    short: "The three quick messages two computers swap to agree to start a conversation.",
    long: 'One side says "can we talk?" (called SYN), the other says "yes, can we?" (SYN-ACK), and the first says "yes" (ACK). If a port answers the first message, something is listening behind it.',
    relatedTerms: ["tcp", "port", "network-scan"],
  },
  {
    id: "dns",
    term: "DNS",
    aka: ["Domain Name System"],
    topic: "networking",
    short:
      "The internet's address book, which turns names like `example.com` into the number addresses computers use.",
    long: "When you type a website's name, your computer asks a DNS server for its IP address first. Attackers sometimes fake DNS answers to send people to the wrong place.",
    relatedTerms: ["domain-name", "ip-address"],
  },
  {
    id: "domain-name",
    term: "Domain name",
    topic: "networking",
    short: "A readable name for a place on the internet, like `example.com`.",
    long: "Names are easier to remember than numbers. DNS turns the name into an IP address. The story in Hacker Simulation uses made-up names ending in `.example`, which can never belong to a real website.",
    relatedTerms: ["dns", "url"],
  },
  {
    id: "router",
    term: "Router",
    topic: "networking",
    short: "A box that passes messages between networks and sends each one the right way.",
    long: "Your home router links your devices to the internet. In an office, routers connect subnets to each other, and often have firewall rules built in.",
    relatedTerms: ["network", "firewall", "subnet"],
  },
  {
    id: "firewall",
    term: "Firewall",
    topic: "networking",
    short: "A guard that sits between computers and decides which messages may pass.",
    long: 'A firewall follows rules like "let anyone reach the website on port 443, but only the office can reach port 22". In missions, some computers are behind firewalls, so a scan from outside can\'t see them.',
    relatedTerms: ["network-segmentation", "port", "router", "defence-in-depth"],
  },
  {
    id: "network-segmentation",
    term: "Network segmentation",
    topic: "networking",
    short:
      "Splitting a network into separate zones, so trouble in one zone can't spread to the others.",
    long: "A shop might keep its card machines on one subnet, staff laptops on another, and guest wifi on a third, with firewalls between them. Then a problem on the guest wifi can't reach the card machines.",
    relatedTerms: ["subnet", "firewall", "defence-in-depth"],
  },
  {
    id: "ssh",
    term: "SSH",
    aka: ["Secure Shell"],
    topic: "networking",
    short:
      "A way to control a computer from far away by typing commands, with everything scrambled so nobody in between can read it.",
    long: "SSH usually answers on port 22. It replaced older ways of logging in from far away, like telnet, because it protects passwords on their way across the network. Most servers are looked after over SSH, so finding port 22 open isn't alarming on its own.",
    relatedTerms: ["telnet", "port", "encryption"],
  },
  {
    id: "telnet",
    term: "Telnet",
    topic: "networking",
    short:
      "An old way to control a computer from far away by typing, which sends everything, passwords included, as readable text.",
    long: "Telnet usually answers on port 23. Anyone who can see the traffic between the two computers can read every word, which is why SSH replaced it decades ago. Telnet left open, especially to everyone, is a classic finding in a security test. You'll meet one in the mission Mapping the network.",
    relatedTerms: ["ssh", "port", "plaintext"],
  },
  {
    id: "ping",
    term: "Ping",
    topic: "networking",
    short: 'A tiny "are you there?" message sent to a computer to see if it answers.',
    long: "If a computer answers a ping, it's switched on and reachable. Many computers are set to ignore pings, so no answer doesn't always mean nobody's home.",
    relatedTerms: ["network-scan", "firewall"],
  },
  {
    id: "host",
    term: "Host",
    topic: "networking",
    short: "Any computer on a network, like a laptop, a server or a printer.",
    long: "Security people say host because the list includes things you might not call a computer: printers, cameras, even smart fridges. Your network map in Hacker Simulation shows each host as you discover it.",
    relatedTerms: ["network", "ip-address", "server"],
  },
  {
    id: "server",
    term: "Server",
    topic: "networking",
    everyday: true,
    short: "A computer that provides something to other computers, like web pages or email.",
    long: "Any computer can be a server. What makes it one is running services that other computers use. Servers are what attackers usually want to reach, and what defenders guard most closely.",
    relatedTerms: ["client", "service", "web-server"],
  },
  {
    id: "client",
    term: "Client",
    topic: "networking",
    short:
      "The computer or program that asks for something, like your browser asking a website for a page.",
    long: "Clients ask, servers answer. The same computer can be both: a laptop is a client when you browse, and a server if it shares files.",
    relatedTerms: ["server", "browser"],
  },
  {
    id: "network-scan",
    term: "Network scan",
    aka: ["port scan"],
    topic: "networking",
    short:
      "Checking a range of addresses to see which computers are switched on, and which of their doors are open.",
    long: "Scanning is how defenders take stock of their own network, and how testers map a client's. Scanning a network you don't have permission to test is against the law in many countries. In an investigation, a scan often shows up in firewall logs as one address knocking on many doors within a few seconds.",
    relatedTerms: ["port", "ping", "service", "authorization"],
  },

  // The web: how websites work, and how they're attacked and protected.
  {
    id: "website",
    term: "Website",
    topic: "web",
    everyday: true,
    short: "A collection of pages you can visit in a web browser.",
    long: "Behind every website is at least one web server sending the pages, and often a database storing its information.",
    relatedTerms: ["web-server", "browser", "url"],
  },
  {
    id: "browser",
    term: "Web browser",
    aka: ["browser"],
    topic: "web",
    everyday: true,
    short: "The app you use to visit websites, like the one you're reading this in.",
    long: "Your browser sends HTTP requests, shows the pages that come back, and keeps cookies for the sites you visit. It also enforces safety rules, like the same-origin policy.",
    relatedTerms: ["http", "cookie", "same-origin-policy"],
  },
  {
    id: "http",
    term: "HTTP",
    aka: ["HyperText Transfer Protocol"],
    topic: "web",
    short: "The set of rules browsers and websites use to ask for pages and send them back.",
    long: "Every page visit is an HTTP request and an HTTP response. Plain HTTP isn't scrambled, so anyone on the same network can read it. That's why sites use HTTPS.",
    relatedTerms: ["https", "http-request", "http-response", "status-code"],
  },
  {
    id: "https",
    term: "HTTPS",
    topic: "web",
    short:
      "The protected way browsers and websites talk, scrambled so nobody in between can read or change it.",
    long: "The S stands for secure. HTTPS uses encryption, and the padlock in your browser's address bar means it's on. It protects the conversation, not the website itself: a scam site can use HTTPS too.",
    relatedTerms: ["http", "encryption"],
  },
  {
    id: "url",
    term: "URL",
    aka: ["web address"],
    topic: "web",
    short: "The full address of a page on the web, like `example.com/help`.",
    long: "A URL names the protocol (`https://`), the domain name (`example.com`) and the page (`/help`). Checking the domain name carefully is one of the best ways to spot a phishing link.",
    relatedTerms: ["domain-name", "http", "phishing"],
  },
  {
    id: "http-request",
    term: "HTTP request",
    topic: "web",
    short: "The message your browser sends to a website asking for something, such as a page.",
    long: "A request names what it wants (`GET /index.html`) and carries extra lines called headers, including any cookies. Anything in a request can be changed by whoever sends it, so websites must never trust it blindly.",
    relatedTerms: ["http", "http-response", "cookie"],
  },
  {
    id: "http-response",
    term: "HTTP response",
    topic: "web",
    short:
      "The message a website sends back, with the page you asked for or a note saying why not.",
    long: "Every response starts with a status code, like `200` (here it is) or `404` (not found), then headers, then the page itself. Headers often reveal what software the server runs.",
    relatedTerms: ["http", "http-request", "status-code"],
  },
  {
    id: "status-code",
    term: "Status code",
    topic: "web",
    short:
      'A three-digit number in a website\'s reply that says how things went, like 404 for "not found".',
    long: 'Codes in the 200s mean success, 300s mean "look elsewhere", 400s mean the request had a problem, and 500s mean the server did. A `403` means "you\'re not allowed", which tells you something is there.',
    relatedTerms: ["http-response", "http"],
  },
  {
    id: "cookie",
    term: "Cookie",
    topic: "web",
    short:
      "A small note a website asks your browser to keep and send back on each visit, so it remembers you.",
    long: "Cookies keep you logged in and remember what's in your basket. Because a login cookie proves who you are, stealing one can be as good as stealing a password. Hacker Simulation itself uses no cookies.",
    relatedTerms: ["session", "browser", "http-request"],
  },
  {
    id: "session",
    term: "Session",
    topic: "web",
    short:
      "The stretch of time a website remembers you're logged in, usually tracked with a small note your browser keeps.",
    long: "When you log in, the website gives your browser a session id in a cookie. Every later request carries it. Logging out, or waiting too long, ends the session.",
    relatedTerms: ["cookie", "authentication"],
  },
  {
    id: "same-origin-policy",
    term: "Same-origin policy",
    topic: "web",
    short:
      "A browser rule that stops one website's code from reading another website's information.",
    long: "Without it, a page you visited could read your email in another tab. Two pages share an origin only if their protocol, domain name and port all match.",
    relatedTerms: ["browser", "cross-site-scripting"],
  },
  {
    id: "owasp-top-10",
    term: "OWASP Top 10",
    topic: "web",
    short: "A well-known list of the ten most common kinds of website security weak spots.",
    long: "It's published by the Open Worldwide Application Security Project, a non-profit group, and updated every few years. Web developers and testers use it as a checklist. Injection and broken access control are regulars on it.",
    relatedTerms: ["sql-injection", "cross-site-scripting", "vulnerability"],
  },
  {
    id: "cross-site-scripting",
    term: "Cross-site scripting",
    aka: ["XSS"],
    topic: "web",
    short: "Sneaking harmful code into a web page so it runs in other visitors' browsers.",
    long: "It happens when a website shows something a user typed, like a comment, without making it safe first. The code then runs as if the website wrote it, and can read that visitor's cookies. Websites defend by treating everything users type as text, never as code.",
    relatedTerms: ["same-origin-policy", "cookie", "owasp-top-10"],
  },
  {
    id: "sql-injection",
    term: "SQL injection",
    aka: ["SQLi"],
    topic: "web",
    short: "Typing database commands into a website's form so the website runs them by mistake.",
    long: "SQL is the language many databases speak. If a login form pastes what you type straight into a database command, a carefully written input can change the command's meaning. The fix is to keep user input and commands strictly apart.",
    relatedTerms: ["database", "owasp-top-10"],
  },
  {
    id: "database",
    term: "Database",
    topic: "web",
    everyday: true,
    short: "An organised store of information that a program can search and update quickly.",
    long: "Websites keep accounts, orders and messages in databases. That makes them a favourite target, which is why they usually sit behind a firewall where only the web server can reach them.",
    relatedTerms: ["sql-injection", "web-server"],
  },
  {
    id: "web-server",
    term: "Web server",
    topic: "web",
    short: "A program, or the computer running it, that sends web pages to browsers.",
    long: "Web servers usually listen on port 80 for HTTP and 443 for HTTPS. Their banners and headers often name the software and version. Its access log, a line for every request, is often the first evidence an investigator reads after a website break-in.",
    relatedTerms: ["server", "http", "banner", "port"],
  },

  // Cryptography: how secrets are scrambled, stored and checked.
  {
    id: "password",
    term: "Password",
    topic: "crypto",
    everyday: true,
    short: "A secret word or phrase that proves an account is yours.",
    long: "Long passwords beat clever ones: a phrase of four random words is far harder to guess than `P@ssw0rd!`. Websites shouldn't store your password itself, only a hash of it.",
    relatedTerms: ["hash", "authentication", "password-manager", "passphrase"],
  },
  {
    id: "encryption",
    term: "Encryption",
    topic: "crypto",
    short:
      "Scrambling information so only someone with the right secret can unscramble and read it.",
    long: "Encryption turns plaintext into ciphertext using a key. Unscrambling it with the key is called decryption. Unlike a hash, encryption is meant to be reversed, by the right person.",
    relatedTerms: [
      "encryption-key",
      "plaintext",
      "ciphertext",
      "decryption",
      "symmetric-encryption",
    ],
  },
  {
    id: "encryption-key",
    term: "Encryption key",
    topic: "crypto",
    short: "The secret value that locks and unlocks scrambled information.",
    long: "The method of scrambling is usually public. The key is what's secret. Anyone who gets the key can read everything it protects, so keys are guarded even more carefully than passwords.",
    relatedTerms: ["encryption"],
  },
  {
    id: "plaintext",
    term: "Plaintext",
    topic: "crypto",
    short: "Information in its normal, readable form, before it's scrambled.",
    long: "A password stored in plaintext can be read by anyone who opens the file, which is a serious mistake to find on a server.",
    relatedTerms: ["ciphertext", "encryption"],
  },
  {
    id: "ciphertext",
    term: "Ciphertext",
    topic: "crypto",
    short:
      "Information after it's been scrambled, which looks like nonsense without the secret to unscramble it.",
    long: "Good ciphertext gives away nothing about the original, not even which letters were used.",
    relatedTerms: ["plaintext", "encryption", "encryption-key"],
  },
  {
    id: "hash",
    term: "Hash",
    aka: ["hash function", "hashing"],
    topic: "crypto",
    short:
      "A fixed-length fingerprint made from any piece of data, which can't be turned back into the original, only matched by guessing.",
    long: "The same input always gives the same hash, and changing one letter changes the whole thing. Websites store password hashes instead of passwords: when you log in, they hash what you typed and compare. Investigators hash the original evidence and their copy of it: if the two hashes match, the copy is exact.",
    relatedTerms: ["salt", "password-cracking", "integrity", "checksum", "collision"],
    relatedLessons: ["foundations-hashing-for-evidence"],
  },
  {
    id: "salt",
    term: "Salt",
    topic: "crypto",
    short:
      "A random extra value mixed into a password before it's fingerprinted, so two identical passwords look different when stored.",
    long: "Without salt, everyone with the password `sunshine` has the same hash, and one lucky guess reveals them all. With salt, each has to be guessed separately. The salt isn't secret: it's stored right next to the hash.",
    relatedTerms: ["hash", "password-cracking", "rainbow-table", "key-stretching"],
  },
  {
    id: "brute-force-attack",
    term: "Brute-force attack",
    aka: ["brute force"],
    topic: "crypto",
    short: "Trying every possible password, one after another, until one works.",
    long: "Short passwords fall fast: there are only so many combinations. Every extra character multiplies the work. Websites defend by slowing down or locking accounts after repeated failed logins, which also stand out in the logs.",
    relatedTerms: ["dictionary-attack", "password-cracking", "password"],
  },
  {
    id: "dictionary-attack",
    term: "Dictionary attack",
    topic: "crypto",
    short: "Guessing passwords from a list of common ones, instead of trying every possibility.",
    long: "Lists of leaked passwords show that millions of people pick the same few, like `123456`. A dictionary attack tries those first, which is why an unusual passphrase is so much safer than a common word.",
    relatedTerms: ["brute-force-attack", "password-cracking"],
  },
  {
    id: "password-cracking",
    term: "Password cracking",
    topic: "crypto",
    short:
      "Working out a password from its stored fingerprint by guessing again and again until one matches.",
    long: "Cracking doesn't reverse a hash. It hashes guess after guess and compares. Salt and slow hash methods make each guess cost more. Missions only ever crack made-up hashes in the simulation.",
    relatedTerms: ["hash", "salt", "rainbow-table", "key-stretching"],
  },

  {
    id: "collision",
    term: "Collision",
    aka: ["hash collision"],
    topic: "crypto",
    short:
      "When two different pieces of information end up with the exact same fingerprint, which a good fingerprint method makes far too hard to arrange.",
    long: "A fingerprint is much shorter than what it was made from, so collisions have to exist somewhere. What matters is whether anyone can produce one on demand. Older methods such as MD5 turned out to allow that, which is why they're retired for anything that has to be trusted.",
    relatedTerms: ["hash", "checksum", "integrity"],
    relatedLessons: ["foundations-hashing-for-evidence"],
  },
  {
    id: "checksum",
    term: "Checksum",
    topic: "crypto",
    short:
      "A short fingerprint published next to a download so you can check that what arrived is exactly what was sent.",
    long: "You work out the fingerprint of the file you received and compare it to the published one. If a single byte changed on the way, or someone swapped the file for their own, the two won't match. It's the same idea as a hash, used to prove nothing changed rather than to keep a secret.",
    relatedTerms: ["hash", "collision", "integrity", "digital-evidence"],
  },
  {
    id: "decryption",
    term: "Decryption",
    topic: "crypto",
    short: "Turning scrambled information back into its readable form with the right secret.",
    long: "Decryption is encryption run backwards, and it only works for whoever holds the key. This is the difference people trip over: if information can't be turned back at all, by anyone, it was hashed rather than encrypted.",
    relatedTerms: ["encryption", "encryption-key", "ciphertext", "plaintext"],
  },
  {
    id: "symmetric-encryption",
    term: "Symmetric encryption",
    topic: "crypto",
    short:
      "Scrambling where the same secret both locks and unlocks the information, like one key for one door.",
    long: "It's quick, and it suits anything where the same person or machine does both halves, such as an encrypted backup you'll open yourself later. The hard part is handing that shared secret to someone else without anyone in between seeing it.",
    relatedTerms: ["asymmetric-encryption", "encryption", "encryption-key"],
  },
  {
    id: "asymmetric-encryption",
    term: "Asymmetric encryption",
    aka: ["public-key encryption"],
    topic: "crypto",
    short:
      "Scrambling with a pair of matching secrets, where anything locked with one of them can only be unlocked with the other.",
    long: "One of the pair is handed out to anyone who wants it, and the other never leaves its owner. That's how your browser can agree on a secret with a website it has never met, and how `ssh` lets you log in without sending a password anywhere.",
    relatedTerms: ["symmetric-encryption", "public-key", "private-key", "https"],
  },
  {
    id: "public-key",
    term: "Public key",
    topic: "crypto",
    short:
      "The half of a matching pair of secrets that you hand out freely, so anyone can lock a message that only you can open.",
    long: "Publishing it gives nothing away: knowing the public half doesn't tell anyone the private half. Servers hand theirs to every visitor, and you copy yours onto a machine you want to log in to with `ssh`.",
    relatedTerms: ["private-key", "asymmetric-encryption", "encryption-key", "ssh"],
  },
  {
    id: "private-key",
    term: "Private key",
    topic: "crypto",
    short:
      "The half of a matching pair of secrets that never leaves your machine, and that opens whatever the public half locked.",
    long: "Anyone who copies it can pretend to be you, so it's kept in a file only your own account may read, usually with a passphrase on top. Finding one lying about with loose permissions is a serious finding in a security test.",
    relatedTerms: ["public-key", "asymmetric-encryption", "encryption-key", "permissions"],
  },
  {
    id: "rainbow-table",
    term: "Rainbow table",
    topic: "crypto",
    short:
      "A huge prepared list of common passwords next to their fingerprints, so a stolen fingerprint can be looked up instead of guessed.",
    long: "Looking something up takes no time at all, which is what made these tables worth building. Salt is the answer: a random extra value per password means every stored fingerprint was made differently, and a prepared list matches none of them.",
    relatedTerms: ["salt", "hash", "password-cracking", "dictionary-attack"],
  },
  {
    id: "key-stretching",
    term: "Key stretching",
    aka: ["slow hashing"],
    topic: "crypto",
    short:
      "Deliberately making each password check take a moment, so that working through billions of guesses stops being worth anyone's time.",
    long: "Methods built for passwords, such as bcrypt and Argon2, repeat their work thousands of times over. A tenth of a second costs you nothing when you log in once a day, and it turns an afternoon of guessing into years.",
    relatedTerms: ["hash", "salt", "password-cracking", "brute-force-attack"],
  },
  {
    id: "credentials",
    term: "Credentials",
    topic: "crypto",
    short:
      "The pieces of information an account uses to prove who it is, such as a name and a password together.",
    long: "They can also be a key file, a one-time code, or a long string an app uses instead of a person. Credentials left in a script, a settings file or a note on a shared drive are one of the most common findings in a real security test, which is why missions leave a few where you can find them.",
    relatedTerms: ["password", "authentication", "user-account", "credential-stuffing"],
  },
  {
    id: "credential-stuffing",
    term: "Credential stuffing",
    topic: "crypto",
    short:
      "Taking names and passwords leaked from one website and trying them on many others, counting on people having reused them.",
    long: "It needs no skill and it works often enough to be worth doing at scale, which is why a leaked list stays useful for years. A different password per site, kept in a password manager, takes the whole attack away.",
    relatedTerms: ["data-breach", "password-manager", "multi-factor-authentication", "password"],
  },
  {
    id: "password-manager",
    term: "Password manager",
    topic: "crypto",
    short:
      "An app that makes up a different long password for every site and remembers them all for you.",
    long: "One passphrase unlocks it, and it fills the rest in. It also tells you which of your passwords are reused or turned up in a leak, and because it checks the address before filling anything in, it won't hand your password to a lookalike site.",
    relatedTerms: ["passphrase", "password", "credential-stuffing", "phishing"],
  },
  {
    id: "passphrase",
    term: "Passphrase",
    topic: "crypto",
    short:
      "A secret made of several random words, which is far harder to guess than a short jumble of symbols and much quicker to type.",
    long: "Length is what makes guessing slow, and four random words give you length you can picture. Pick the words at random rather than writing a sentence, and don't use a famous line or a song lyric: guessing lists have those in them too.",
    relatedTerms: ["password", "password-manager", "dictionary-attack", "brute-force-attack"],
  },
  // Forensics: finding out what happened after the fact.
  {
    id: "digital-forensics",
    term: "Digital forensics",
    topic: "forensics",
    short:
      "Investigating computers after something has gone wrong, to work out what happened, when, and how.",
    long: "Investigators collect evidence without changing it, then piece together a timeline from logs, files and timestamps. It's detective work, and a big part of your team's job in the story.",
    relatedTerms: ["digital-evidence", "timeline", "log-file", "indicator-of-compromise"],
    relatedLessons: ["foundations-what-forensics-is"],
  },
  {
    id: "digital-evidence",
    term: "Digital evidence",
    topic: "forensics",
    short:
      "Files, records and traces that show what happened on a computer, kept unchanged so they can be trusted.",
    long: "Investigators work on copies and record a hash of the original, so they can prove later that nothing was altered. Evidence that might have been changed can't be relied on.",
    relatedTerms: ["chain-of-custody", "forensic-image", "volatile-data", "digital-forensics"],
    relatedLessons: ["foundations-what-forensics-is", "foundations-chain-of-custody"],
  },
  {
    id: "timestamp",
    term: "Timestamp",
    topic: "forensics",
    short:
      "The date and time recorded next to an event, like when a file was changed or someone logged in.",
    long: "Timestamps let you line up events from different places. Watch the time zone: one log in local time and another in UTC can make events look hours apart.",
    relatedTerms: ["timeline", "log-file", "coordinated-universal-time", "clock-drift"],
  },
  {
    id: "timeline",
    term: "Timeline",
    topic: "forensics",
    short: "Events from different places put in time order, to show the story of what happened.",
    long: "A login from an unusual place at 02:14, a new file at 02:16, a spike in outgoing traffic at 02:20: on their own they're odd, and in order they tell a story.",
    relatedTerms: ["timestamp", "clock-drift", "digital-forensics", "security-incident"],
  },
  {
    id: "indicator-of-compromise",
    term: "Indicator of compromise",
    aka: ["IOC"],
    topic: "forensics",
    short:
      "A clue that a computer has been broken into, like a strange file or a login from an unknown place.",
    long: "Investigators share these clues so other teams can check their own computers for the same signs. A known bad address, an unexpected new account and a hash of a malware file are all indicators.",
    relatedTerms: ["digital-forensics", "malware", "alert"],
  },
  {
    id: "chain-of-custody",
    term: "Chain of custody",
    topic: "forensics",
    short:
      "A record of everyone who handled a piece of evidence, and when, so nobody can claim it was tampered with.",
    long: "If the chain has a gap, a court or a client may not trust the evidence. Writing down who copied what, when, and how is dull, and it matters.",
    relatedTerms: ["digital-evidence", "digital-forensics"],
    relatedLessons: ["foundations-chain-of-custody"],
  },
  {
    id: "metadata",
    term: "Metadata",
    topic: "forensics",
    short: "Information about a file rather than inside it, like who made it and when.",
    long: "A photo's metadata can include the camera and the place it was taken. A document's can include the author's name. It's often what gives a secret away.",
    relatedTerms: ["timestamp", "digital-evidence"],
  },

  {
    id: "log-entry",
    term: "Log entry",
    aka: ["log line"],
    topic: "forensics",
    short: "One line in a computer's diary, recording a single thing that happened and when.",
    long: "A typical entry holds a time, the program that wrote it, and a short message: `Failed password for admin from 10.0.4.19`. On its own it means little. Next to the forty entries around it, it starts to mean something.",
    relatedTerms: ["log-file", "timestamp", "timeline"],
  },
  {
    id: "log-rotation",
    term: "Log rotation",
    topic: "forensics",
    short:
      "The routine that starts a fresh diary every so often and throws the oldest one away, so records never fill the disk.",
    long: "Rotation is why an investigation can hit a wall: if records are kept for seven days and the break-in was three weeks ago, there's nothing left to read. Deciding how long to keep them is a choice worth making before anything goes wrong, not after.",
    relatedTerms: ["log-file", "digital-evidence", "digital-forensics"],
  },
  {
    id: "coordinated-universal-time",
    term: "Coordinated universal time",
    aka: ["UTC"],
    topic: "forensics",
    short:
      "One world clock that computers record times against, so a record written in one country lines up with a record written in another.",
    long: "Most servers keep their own records in it and convert only when showing you something. Put everything in one zone before you build a timeline: two records four hours apart may have been written at the same moment.",
    relatedTerms: ["timestamp", "timeline", "clock-drift"],
  },
  {
    id: "clock-drift",
    term: "Clock drift",
    topic: "forensics",
    short:
      "The slow slide of one computer's time away from another's, until their records no longer line up.",
    long: "A machine running four minutes fast puts its events four minutes early, which can make an effect look like it came before its cause. Machines are kept in step by checking against a shared time source, and an investigator checks the clocks before trusting the order of anything.",
    relatedTerms: ["timestamp", "timeline", "coordinated-universal-time"],
  },
  {
    id: "forensic-image",
    term: "Forensic image",
    aka: ["disk image", "image"],
    topic: "forensics",
    short:
      "An exact copy of everything on a drive, made so investigators can work on the copy and leave the original untouched.",
    long: "The copy is fingerprinted with a hash so anyone can prove later that it matches, and the original is locked away. Working on the original changes timestamps and can destroy the very thing you were trying to show.",
    relatedTerms: ["digital-evidence", "chain-of-custody", "hash", "volatile-data"],
    relatedLessons: ["foundations-hashing-for-evidence", "foundations-order-of-volatility"],
  },
  {
    id: "volatile-data",
    term: "Volatile data",
    topic: "forensics",
    short:
      "Information that disappears the moment a computer is switched off, such as what was running in its memory.",
    long: "Which programs were running, which connections were open, what was typed a minute ago: often none of it is written down anywhere. Investigators collect the things that vanish first, then the things that will still be there tomorrow.",
    relatedTerms: ["digital-evidence", "forensic-image", "process", "digital-forensics"],
    relatedLessons: ["foundations-order-of-volatility"],
  },
  {
    id: "acquisition",
    term: "Acquisition",
    topic: "forensics",
    short:
      "Making a complete, exact copy of a device's contents for an investigation, without changing the original.",
    long: "It's the collection step of an investigation. The copy is a forensic image, made through a write-blocker so nothing can be written to the original, and fingerprinted with a hash on both sides so anyone can check later that it matches. In Case 1 you acquire the yard office laptop's disk.",
    relatedTerms: ["forensic-image", "write-blocker", "hash", "chain-of-custody"],
    relatedLessons: ["foundations-what-forensics-is", "foundations-chain-of-custody"],
  },
  {
    id: "write-blocker",
    term: "Write-blocker",
    aka: ["write blocker"],
    topic: "forensics",
    short:
      "A device or program between an investigator's computer and a drive that lets the drive be read but never written to.",
    long: "Plugging a drive straight into a computer lets the computer write to it: last-opened times, small housekeeping files, sometimes more. Any of that changes the evidence and its hash. A hardware write-blocker is a small box in the cable; a software one tells the operating system to treat the drive as read-only. Either way, the custody log records that it was on.",
    relatedTerms: ["acquisition", "forensic-image", "hash", "digital-evidence"],
    relatedLessons: ["foundations-chain-of-custody", "foundations-hashing-for-evidence"],
  },
  {
    id: "order-of-volatility",
    term: "Order of volatility",
    topic: "forensics",
    short:
      "Collecting the evidence that disappears fastest first, and the evidence that lasts longest last.",
    long: "Network connections and who is signed in can change in seconds, memory is lost at power-off, the disk survives, and backups last months. RFC 3227, a published internet guideline for collecting evidence, lists them in that order. It's a guide to what's at risk, not a rule that decides for you. Not to be confused with Volatility, a real memory-analysis tool.",
    relatedTerms: ["volatile-data", "forensic-image", "process"],
    relatedLessons: ["foundations-order-of-volatility"],
  },
  {
    id: "custody-log",
    term: "Custody log",
    topic: "forensics",
    short:
      "The running list of who had a piece of evidence, when they had it, and what they did with it.",
    long: 'Each line is short: a time, a name, an action. "Handed bag 0412 to Idris, seal intact." Every change of hands and every action on the evidence gets a line, so the chain of custody has no gaps. In a case, the workstation keeps one of your own actions for you.',
    relatedTerms: ["chain-of-custody", "digital-evidence", "acquisition"],
    relatedLessons: ["foundations-chain-of-custody"],
  },
  {
    id: "md5",
    term: "MD5",
    topic: "crypto",
    short:
      "An older recipe for making a 128-bit fingerprint of any data, which still catches accidental changes but can be fooled on purpose.",
    long: "An MD5 hash is written as 32 characters. It was the forensic standard for years, and you'll still find it on older handover forms. Since the mid-2000s people can manufacture two different files with the same MD5 in about a minute, so investigators record SHA-256 as well, never MD5 alone.",
    relatedTerms: ["hash", "sha-256", "collision"],
    relatedLessons: ["foundations-hashing-for-evidence"],
  },
  {
    id: "sha-256",
    term: "SHA-256",
    topic: "crypto",
    short:
      "The recipe most investigators use today to make a 256-bit fingerprint of any data, so that two copies can be shown to match.",
    long: "A SHA-256 hash is written as 64 characters. It comes from the United States' Secure Hash Standard, and nobody has ever found two different inputs that give the same SHA-256. Handover forms, custody logs and verification tools all record it.",
    relatedTerms: ["hash", "md5", "integrity", "collision"],
    relatedLessons: ["foundations-hashing-for-evidence"],
  },
  // Defending: spotting attacks early and keeping systems safe.
  {
    id: "blue-team",
    term: "Blue team",
    topic: "blue-team",
    short: "The defenders who protect a system and watch for attacks.",
    long: "Blue teams set up protections, watch the logs, respond to alerts and clean up after incidents. Every mission in Hacker Simulation includes something from the blue team's side.",
    relatedTerms: ["red-team", "incident-response", "security-operations-centre"],
  },
  {
    id: "red-team",
    term: "Red team",
    topic: "blue-team",
    short: "A group that plays the attacker, with permission, to test how well the defenders do.",
    long: "A red team exercise is like a fire drill for security. Afterwards both sides compare notes so the defences get better. Everything a red team does is agreed in writing first.",
    relatedTerms: ["blue-team", "penetration-test", "rules-of-engagement"],
  },
  {
    id: "security-operations-centre",
    term: "Security operations centre",
    aka: ["SOC"],
    topic: "blue-team",
    short:
      "The team, and often the room, that watches an organisation's computers around the clock for signs of attack.",
    long: "Analysts in a security operations centre sort through alerts, decide which ones are real, and start the response. Many security careers begin there.",
    relatedTerms: ["alert", "blue-team", "incident-response"],
  },
  {
    id: "security-incident",
    term: "Security incident",
    topic: "blue-team",
    short:
      "Something that harms, or might harm, the safety of a system or its information, like a break-in or a leak.",
    long: "Not every alert is an incident: most turn out to be harmless. Once a team decides something is an incident, incident response begins.",
    relatedTerms: ["incident-response", "data-breach", "alert", "timeline"],
  },
  {
    id: "incident-response",
    term: "Incident response",
    topic: "blue-team",
    short:
      "The plan and the work of dealing with an attack: stopping it, cleaning up, and learning from it.",
    long: "The usual steps are: prepare, spot it, contain it, remove it, recover, and review what happened. Teams practise before anything goes wrong, so nobody's making it up under pressure.",
    relatedTerms: ["security-incident", "containment", "eradication", "post-incident-review"],
  },
  {
    id: "alert",
    term: "Alert",
    topic: "blue-team",
    short: "A warning a security tool raises when it sees something that looks suspicious.",
    long: "Too many false alarms and people stop paying attention, so tuning alerts is a real skill. A good alert says what happened, where, and why it might matter.",
    relatedTerms: ["triage", "false-positive", "alert-fatigue", "security-operations-centre"],
  },
  {
    id: "intrusion-detection-system",
    term: "Intrusion detection system",
    aka: ["IDS"],
    topic: "blue-team",
    short:
      "Software that watches computers or the messages between them and raises the alarm when something looks like an attack.",
    long: "Some look for known patterns, like a fingerprint of a known attack. Others learn what normal looks like and flag anything unusual. Either way, a person still decides what the alert means.",
    relatedTerms: ["alert", "baseline", "false-negative", "firewall"],
  },
  {
    id: "patch",
    term: "Patch",
    topic: "blue-team",
    short: "An update that fixes a weak spot or a bug in software.",
    long: "Many break-ins use weaknesses that already had a patch, months earlier, that nobody installed. Keeping software up to date is one of the most effective defences there is.",
    relatedTerms: ["vulnerability", "hardening"],
  },
  {
    id: "hardening",
    term: "Hardening",
    topic: "blue-team",
    short:
      "Making a system harder to attack by switching off what isn't needed and tightening its settings.",
    long: "Closing unused ports, removing old accounts, changing default passwords and applying patches are all hardening. Each one shrinks the attack surface.",
    relatedTerms: ["attack-surface", "patch", "default-password", "baseline"],
  },
  {
    id: "asset-inventory",
    term: "Asset inventory",
    topic: "blue-team",
    short: "A list of every device and program an organisation owns, so nothing gets forgotten.",
    long: "You can't protect what you don't know about. Forgotten computers, like an old backup machine nobody remembers setting up, are a favourite way in for attackers. Security teams build the list by asking around and by scanning their own networks.",
    relatedTerms: ["network-scan", "attack-surface", "hardening"],
  },
  {
    id: "two-factor-authentication",
    term: "Two-factor authentication",
    aka: ["2FA"],
    topic: "blue-team",
    short: "Logging in with two kinds of proof, such as a password plus a code on your phone.",
    long: "Even if someone steals your password, they still need the second factor. It stops most account break-ins, which is why security teams push everyone to turn it on.",
    relatedTerms: ["multi-factor-authentication", "authentication-factor", "one-time-code"],
  },
  {
    id: "backup",
    term: "Backup",
    topic: "blue-team",
    short:
      "A spare copy of files kept somewhere else, so they can be restored if the originals are lost or locked.",
    long: "A backup only helps if it's kept apart from what it protects, and if someone has tested restoring from it. It's the best answer to ransomware.",
    relatedTerms: ["ransomware", "availability"],
  },
  {
    id: "ransomware",
    term: "Ransomware",
    topic: "blue-team",
    short: "Harmful software that locks up files and demands payment to unlock them.",
    long: "Ransomware usually gets in through phishing or an unpatched weakness, then spreads across the network. Good backups, patching and network segmentation limit the damage.",
    relatedTerms: ["malware", "backup", "availability", "network-segmentation"],
  },
  {
    id: "triage",
    term: "Triage",
    topic: "blue-team",
    short:
      "Sorting a pile of warnings by how urgent each one looks, so the worst of them gets attention first.",
    long: "The word comes from hospitals. An analyst triaging asks three questions of each one: is it real, does it matter here, and does someone need to act now. This is most of what a first job in defending looks like, and it's a skill in its own right.",
    relatedTerms: ["alert", "false-positive", "severity", "security-operations-centre"],
  },
  {
    id: "false-positive",
    term: "False positive",
    topic: "blue-team",
    short: "A warning about something that turns out to be harmless.",
    long: "A backup job reading thousands of files at 3am looks a lot like someone copying everything. Most warnings are false positives, and tuning the tool so the harmless ones stop arriving is how a team stays sharp for the real ones.",
    relatedTerms: ["true-positive", "false-negative", "alert", "triage", "alert-fatigue"],
  },
  {
    id: "true-positive",
    term: "True positive",
    topic: "blue-team",
    short: "A warning about something that turns out to be real.",
    long: "Every one is a small win for whoever set the tool up. Teams count them next to the harmless ones, because a rule that has never once been right is costing attention it doesn't earn.",
    relatedTerms: ["false-positive", "alert", "security-incident"],
  },
  {
    id: "false-negative",
    term: "False negative",
    topic: "blue-team",
    short: "Something harmful that happened without any warning being raised at all.",
    long: "This is the quiet one. You don't find these in today's warnings; you find them weeks later, in a review or in a phone call from somebody else. Several different tools, watching in different ways, means one of them missing something isn't the end of the story.",
    relatedTerms: ["false-positive", "alert", "defence-in-depth", "intrusion-detection-system"],
  },
  {
    id: "alert-fatigue",
    term: "Alert fatigue",
    topic: "blue-team",
    short: "What happens to people who get so many warnings that they stop reading them properly.",
    long: "Serious break-ins have happened with the warning sitting unread in a queue of thousands. Cutting the noise down is security work in its own right, not tidying up, and it's why a team will happily switch off a rule that cries wolf.",
    relatedTerms: ["alert", "false-positive", "triage"],
  },
  {
    id: "baseline",
    term: "Baseline",
    topic: "blue-team",
    short:
      "A picture of what normal looks like for a set of computers, so anything unusual stands out against it.",
    long: "If you know a machine talks to two others and nothing else, a third connection is worth a look. Teams write the baseline down while things are calm, which is the quiet work that makes later warnings mean anything.",
    relatedTerms: ["alert", "intrusion-detection-system", "asset-inventory", "hardening"],
  },
  {
    id: "severity",
    term: "Severity",
    topic: "blue-team",
    short:
      "How much harm something could do, written as a level so that people can agree what to deal with first.",
    long: "Levels usually run from low to critical. Severity isn't the same as urgency: a critical weak spot on a machine that's switched off can wait, while a middling one on a public website can't.",
    relatedTerms: ["triage", "alert", "risk", "vulnerability"],
  },
  {
    id: "data-breach",
    term: "Data breach",
    topic: "blue-team",
    short:
      "An event where information someone was trusted to look after ends up in the hands of people who shouldn't have it.",
    long: "The details decide how bad it is. A stolen table of salted, slowly-hashed passwords is a bad week; a stolen table of plaintext passwords is a disaster for every other site where those people reused them.",
    relatedTerms: [
      "security-incident",
      "confidentiality",
      "credential-stuffing",
      "incident-response",
    ],
  },
  {
    id: "containment",
    term: "Containment",
    topic: "blue-team",
    short: "Stopping trouble from spreading while you work out what to do about it.",
    long: "Pulling a machine off the network, switching off an account or blocking an address buys the team time to think. It comes before cleaning up, and it's worth agreeing in advance who is allowed to unplug what in a hurry.",
    relatedTerms: ["incident-response", "eradication", "security-incident", "network-segmentation"],
  },
  {
    id: "eradication",
    term: "Eradication",
    topic: "blue-team",
    short:
      "Removing whatever caused the trouble, so it can't start up again the moment things are back to normal.",
    long: "That means the harmful program and the way in: the unpatched weak spot, the stolen password, the old account nobody had removed. Recovering without this step is how an organisation gets hit twice in the same month.",
    relatedTerms: ["incident-response", "containment", "malware", "patch"],
  },
  {
    id: "post-incident-review",
    term: "Post-incident review",
    aka: ["lessons learned"],
    topic: "blue-team",
    short: "A calm meeting once the trouble is over, to work out what happened and what to change.",
    long: "The useful ones ask what made the mistake possible rather than who made it, because people who expect blame stop speaking up early, and speaking up early is worth more than anything said in the meeting. The output is a short list of changes with names and dates on them.",
    relatedTerms: ["incident-response", "security-incident", "blue-team", "timeline"],
  },
  {
    id: "default-password",
    term: "Default password",
    topic: "blue-team",
    short:
      "The password a device or program comes with out of the box, printed in a manual that anyone can look up.",
    long: "Lists of them are published for thousands of products. A printer, a camera or a router still on the one it shipped with is among the most common ways into a network, and changing it costs a minute.",
    relatedTerms: ["hardening", "password", "attack-surface", "router"],
  },
  {
    id: "multi-factor-authentication",
    term: "Multi-factor authentication",
    aka: ["MFA"],
    topic: "blue-team",
    short:
      "Logging in with proof of two or more different kinds, so one stolen secret isn't enough.",
    long: "Two-factor authentication is the everyday version: a password plus a code. Multi-factor is the same idea without fixing the number, which matters where a workplace asks for a third step on its most sensitive systems. It stops nearly every attack that starts with a leaked password.",
    relatedTerms: [
      "two-factor-authentication",
      "authentication-factor",
      "one-time-code",
      "authentication",
    ],
  },
  {
    id: "authentication-factor",
    term: "Authentication factor",
    topic: "blue-team",
    short:
      "One of the three kinds of proof a login can ask for: something you know, something you have, or something you are.",
    long: "A password is something you know. A phone or a small key you plug in is something you have. A fingerprint is something you are. Two steps of the same kind, like a password and a security question, aren't two factors: whoever gets one is well placed to get the other.",
    relatedTerms: [
      "multi-factor-authentication",
      "two-factor-authentication",
      "authentication",
      "password",
    ],
  },
  {
    id: "one-time-code",
    term: "One-time code",
    topic: "blue-team",
    short:
      "A short number that works once and then stops, sent to your phone or worked out by an app when you log in.",
    long: "Codes made by an app on your own device are safer than codes sent by text message, which can be redirected to someone else's phone. Anyone who rings you up and asks you to read one out is running a scam, without exception.",
    relatedTerms: [
      "two-factor-authentication",
      "multi-factor-authentication",
      "phishing",
      "social-engineering",
    ],
  },
];

/** Fills in the optional fields, so readers never check for missing lists. */
function withDefaults(entry: GlossaryEntryInput): GlossaryEntry {
  return {
    ...entry,
    aka: entry.aka ?? [],
    everyday: entry.everyday ?? false,
    relatedTerms: entry.relatedTerms ?? [],
    relatedLessons: entry.relatedLessons ?? [],
  };
}

/** Every glossary entry, sorted A to Z by term. */
export const GLOSSARY: readonly GlossaryEntry[] = ENTRIES.map(withDefaults).sort((a, b) =>
  a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
);

const BY_ID: ReadonlyMap<string, GlossaryEntry> = new Map(
  GLOSSARY.map((entry) => [entry.id, entry]),
);

/** The entry with this id, or undefined. */
export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}

/** The raw entries as written, for the schema test. */
export const GLOSSARY_SOURCE: readonly GlossaryEntryInput[] = ENTRIES;
