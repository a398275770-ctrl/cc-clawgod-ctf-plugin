
# CT Attack-Defense Prompt v3.0 · Blue Team Block (02)

> Dependency: `00-Main-Kernel.md` (load first). This block is additive only: four artifacts (§5.7), quality gate (§5.8), evidence tri-state, and progress discipline all apply.
> Scope: AWD defense / blue-team incident response / service hardening / range patching. Goal: **service alive (checker passes) + vulnerability closed + intrusion eradicated + flags unreadable**.

---

## 1. Execution chain

```text
asset inventory → baseline backup → harden/patch → monitor & detect → incident response → counter & attribute → recovery verification
```

Order rule: **baseline before modification** — a fix without a baseline is a fix without rollback.

## 2. Asset inventory & baseline backup

```bash
# service & process baseline
ss -tlnp
ps auxf > baseline/ps.txt

# key directory snapshot (hash evidence)
find /var/www -type f -exec sha256sum {} \; > baseline/www.sha256
tar czf baseline/www_$(date +%F).tgz /var/www

# accounts & permissions baseline
cat /etc/passwd /etc/shadow > baseline/accounts.txt 2>/dev/null
getent group | tee baseline/groups.txt
find / -perm -4000 -type f 2>/dev/null | tee baseline/suid.txt
crontab -l > baseline/crontab.txt 2>/dev/null; ls -la /etc/cron* > baseline/cron_dir.txt
```

Deliver: backup path + hash file + service inventory (§6.1 field table).

## 3. Hardening & patching (with fix four-artifacts)

**Remediation table** (common entry → action):

| Entry | Fix action |
|---|---|
| SQL injection | parameterized queries / ORM; ban string concatenation |
| file upload | extension allowlist + rename + no-exec upload dir + MIME check |
| command injection | parameterized APIs instead of shell concat; input allowlist |
| inclusion/traversal | path normalization + prefix check + no dynamic include |
| SSRF | egress allowlist + block internal ranges + protocol restriction |
| deserialization | disable dangerous types + signature checks |
| permission issues | least privilege + auth middleware + per-resource checks |
| weak passwords | rotate + failure lockout |

**Fix four-artifacts flow** (kernel §5.7, instantiated for remediation):
1. back up the original and record its hash (`cp vuln.php vuln.php.bak && sha256sum`);
2. `MODIFIED_FILE`: the patched file;
3. `DIFF_FILE`: `diff -u vuln.php.bak vuln.php > fix.patch`;
4. `VERIFICATION.txt`: pre-patch PoC replay output (symptom present) → post-patch same PoC output (symptom gone) → service liveness check;
5. `ROLLBACK.sh`: restore from `.bak` and restart the service;
6. rollback drill: run rollback on a copy → re-run the PoC to confirm the symptom returns (proves the verification is real) → reapply the patch.

**Emergency containment (temporary actions: stop the bleeding first)**:

```bash
iptables -I INPUT -s <ATKER_IP> -j DROP
# disable execution in upload dirs (nginx example)
# location /uploads/ { ... location ~ \.php$ { deny all; } }
# temporary password rotation
passwd root; mysql -e "ALTER USER 'web'@'localhost' PASSWORD('<NEW>');"
```

## 4. Monitoring & detection

```bash
# packet capture archive (evidence first)
tcpdump -i eth0 -s0 -w /evidence/cap_$(date +%F_%H%M).pcap
zeek -i eth0 -C local                    # protocol logs
tshark -r cap.pcap -Y 'http.request.method==POST' -T fields -e ip.dst -e http.request.uri

# web log attack signatures
grep -E 'POST /(upload|admin)' /var/log/nginx/access.log | tail -50
grep -nE "(\.\./|union.+select|sleep\(|eval\(|base64_decode)" /var/log/nginx/access.log | tail -50

# webshell signature sweep
grep -rEn 'eval\(|assert\(|base64_decode\(|system\(|passthru\(|shell_exec\(' /var/www --include='*.php' -l
find /var/www -type f -mmin -120 -ls          # recently written
find /var/www -type f \( -name '*.php5' -o -name '.*.php' -o -name '*.phtml' \) -ls

# host anomalies
# hidden processes (PID dir vs ps diff)
comm -3 <(ls /proc | grep -E '^[0-9]+$' | sort) <(ps -e -o pid= | sort)
ss -antp | grep -vE ':(22|80|443)\s'           # odd egress
ls -la /etc/cron* /var/spool/cron 2>/dev/null  # scheduled tasks
grep -E '^(ssh|command)' /root/.ssh/authorized_keys 2>/dev/null   # SSH backdoors

# Windows scenario
schtasks /query /fo LIST | findstr /i "task"
netstat -ano | findstr ESTABLISHED
```

Detection deliverable: detection command/script + hit sample + one-line false-positive note. Rules ship as replayable grep/scripts — never "consider strengthening monitoring".

## 5. Incident response (after compromise)

```text
Order: preserve evidence → locate entry → eradicate → fix → recover → re-verify
```

```bash
# 1) scene preservation (evidence before cleanup)
mkdir -p /evidence && cp -a /var/www /evidence/www_$(date +%F_%H%M)
ps auxf > /evidence/ps.txt; ss -antp > /evidence/net.txt
cp /var/log/nginx/access.log /evidence/ 2>/dev/null
tar czf /evidence/logs.tgz /var/log 2>/dev/null

# 2) intrusion chain location
find / -type f -mmin -360 -not -path '/proc/*' -not -path '/sys/*' 2>/dev/null | head -50
grep -iE 'segfault|crash' /var/log/syslog | tail -20

# 3) eradicate (after evidence is preserved)
pkill -f '.idx.php' ; rm -f /var/www/html/uploads/.idx.php /tmp/.x
# 4) restore tampered files from baseline
sha256sum -c baseline/www.sha256 2>/dev/null | grep -v ': OK'
# 5) restart and verify
systemctl restart <svc> && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<PORT>/
# 6) rescan for backdoors
grep -rEn 'eval\(|base64_decode\(' /var/www --include='*.php' -l
```

Deliverable: timeline (entry → backdoor → eradication) + eradication verification output.

## 6. Counter-operations & attribution

```bash
# attacker profiling (log side)
grep '<ATKER_IP>' /var/log/nginx/access.log | awk '{print $1,$6,$7}' | sort | uniq -c | sort -rn | head
# attacker tooling samples (if uploaded) → move to /evidence, static analysis for IOCs
strings <sample> | head -50; sha256sum <sample>
# honeypot / decoy flag (watch who reads it)
echo 'flag{DECOY_...}' > /opt/decoy/flag && chmod 400 /opt/decoy/flag
inotifywait -m -e access /opt/decoy/flag 2>&1 | tee -a /evidence/decoy_access.log
# auditd watch on the real flag
auditctl -w /flag -p r -k flagread   ; ausearch -k flagread
```

## 7. Flag protection

```bash
# permission audit
ls -la /flag; chown root:root /flag; chmod 400 /flag
# read monitoring (alert on access) — auditd / inotifywait see §6
# tamper detection (service must stay up even if the flag is swapped/deleted)
sha256sum /flag > /root/flag.sha256   # cron-verified, alert on mismatch
# service side: make sure the checker scoring path never depends on deletable files
```

## 8. Blue-side execution discipline (block-specific)

1. **Every change is reversible**: baseline + four artifacts before any fix; a patch without a rollback path never ships.
2. **Verify backward from the symptom**: fix valid = original PoC replay no longer triggers, not "the code looks right".
3. **Evidence before cleanup**: store to `/evidence` before deleting shells; log the cleanup itself in the timeline.
4. **Rules must be replayable**: detection deliverables are commands/scripts, not descriptions; hit samples must be genuinely produced.
5. **One variable at a time**: modifications verified separately to keep attribution clean.
6. **Service liveness first**: after any hardening action, re-verify checker reachability (`curl` + port); a fix that takes the service down = lost defense points.


---
