#!/usr/bin/env bash
# Put the inhaler on its VM: deploy/deploy.sh [vm]   (default: inhaler, https://inhaler.exe.xyz/)
# First use provisions it: Node, three systemd units (the loop, the read API on port 8000, a nightly
# backup), the object-storage credentials for the backup, the phone-alert address. The database
# on the VM is never overwritten: a local one is copied up only when the VM has none.
# Run by hand on Anselm's say; a push does not deploy.
set -euo pipefail
VM=${1:-inhaler}; HERE=$(cd "$(dirname "$0")/.." && pwd); HOST="exedev@$VM.exe.xyz"
SSH="ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=5"
$SSH "$HOST" 'command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null && sudo apt-get install -y -q nodejs >/dev/null; }; command -v rsync >/dev/null || sudo apt-get install -y -q rsync >/dev/null; sudo mkdir -p /srv/inhaler/data && sudo chown -R $USER:$USER /srv/inhaler'
rsync -az --delete -e "$SSH" --exclude data --exclude node_modules --exclude .git --exclude env --exclude store.conf "$HERE/" "$HOST:/srv/inhaler/"
$SSH "$HOST" 'test -f /srv/inhaler/data/inhale.db' || { [ -f "$HERE/data/inhale.db" ] && node --no-warnings -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('$HERE/data/inhale.db');d.exec(\"vacuum into '/tmp/inhale-up.db'\")" && rsync -az -e "$SSH" /tmp/inhale-up.db "$HOST:/srv/inhaler/data/inhale.db" && rm -f /tmp/inhale-up.db && echo "copied the local database up (the VM had none)"; }
# credentials for the backup (what a writer of objects needs, under its own prefix) and the alert address; kept on the VM, not in git
if [ -f "$HOME/.config/cf/r2" ]; then { grep -E '^(access_key_id|secret_access_key|endpoint|bucket)=' "$HOME/.config/cf/r2"; echo prefix=inhaler; } | $SSH "$HOST" 'umask 077 && cat > /srv/inhaler/store.conf'; fi
$SSH "$HOST" "test -f /srv/inhaler/env || { umask 077; printf 'INHALE_DB=/srv/inhaler/data/inhale.db\nINHALE_STORE=/srv/inhaler/store.conf\n${NTFY:+INHALE_NTFY=$NTFY\n}' > /srv/inhaler/env; }"
$SSH "$HOST" 'cd /srv/inhaler && npm ci --omit=dev --no-audit --no-fund >/dev/null && for u in loop api backup; do case $u in loop) cmd="loop --every 900";; api) cmd="serve --port 8000 --host 0.0.0.0";; backup) cmd="backup";; esac
sudo tee /etc/systemd/system/inhaler-$u.service >/dev/null <<UNIT
[Unit]
Description=inhaler $u
After=network-online.target
[Service]
User=exedev
WorkingDirectory=/srv/inhaler
EnvironmentFile=/srv/inhaler/env
ExecStart=/usr/bin/node --no-warnings bin/inhale.mjs $cmd
$([ $u = backup ] && echo Type=oneshot || printf "Restart=always\nRestartSec=5")
[Install]
WantedBy=multi-user.target
UNIT
done
sudo tee /etc/systemd/system/inhaler-backup.timer >/dev/null <<UNIT
[Unit]
Description=inhaler backup, nightly
[Timer]
OnCalendar=*-*-* 10:17:00
Persistent=true
[Install]
WantedBy=timers.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable -q inhaler-loop inhaler-api inhaler-backup.timer && sudo systemctl restart inhaler-loop inhaler-api && sudo systemctl start inhaler-backup.timer && sleep 2 && systemctl is-active inhaler-loop inhaler-api inhaler-backup.timer | tr "\n" " "'
echo; echo "https://$VM.exe.xyz/"
