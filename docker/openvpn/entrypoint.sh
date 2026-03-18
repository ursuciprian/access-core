#!/bin/bash

EASYRSA_DIR="/etc/openvpn/easy-rsa"
PKI_DIR="/etc/openvpn/easy-rsa/pki"
CCD_DIR="/etc/openvpn/ccd"
SERVER_CONF="/etc/openvpn/server.conf"
OPENVPN_SUBNET="${OPENVPN_SERVER_SUBNET:-10.8.0.0 255.255.0.0}"

# Ensure CCD directory exists
mkdir -p "$CCD_DIR"

# Start SSH daemon immediately so the app can connect while PKI initializes
echo "Starting SSH daemon..."
/usr/sbin/sshd -D &
SSH_PID=$!

# Initialize PKI if not already done
if [ ! -f "$PKI_DIR/issued/server.crt" ]; then
    echo "Initializing PKI (DH params may take several minutes on ARM)..."
    cd "$EASYRSA_DIR"

    # Only init-pki if no CA exists yet
    if [ ! -f "$PKI_DIR/ca.crt" ]; then
        ./easyrsa init-pki
        echo "openvpn-ca" | ./easyrsa build-ca nopass
    fi

    # Generate DH if missing
    if [ ! -f "$PKI_DIR/dh.pem" ]; then
        ./easyrsa gen-dh
    fi

    # Generate server cert if missing
    ./easyrsa --batch build-server-full server nopass

    # Generate TLS auth key if missing
    if [ ! -f "/etc/openvpn/ta.key" ]; then
        openvpn --genkey tls-auth /etc/openvpn/ta.key
    fi

    echo "PKI initialized."
else
    echo "PKI already initialized."
fi

# Create server config AFTER PKI is ready
if [ ! -f "$SERVER_CONF" ]; then
    echo "Creating server config..."
    cat > "$SERVER_CONF" <<EOF
port 1194
proto udp
dev tun
topology subnet
ca /etc/openvpn/easy-rsa/pki/ca.crt
cert /etc/openvpn/easy-rsa/pki/issued/server.crt
key /etc/openvpn/easy-rsa/pki/private/server.key
dh /etc/openvpn/easy-rsa/pki/dh.pem
tls-auth /etc/openvpn/ta.key 0
server ${OPENVPN_SUBNET}
client-config-dir ${CCD_DIR}
push "dhcp-option DNS 8.8.8.8"
keepalive 10 60
cipher AES-256-GCM
persist-key
persist-tun
status /var/log/openvpn-status.log 10
management 127.0.0.1 7505
verb 3
EOF
    echo "Server config created."
fi

# IP forwarding is enabled via docker-compose sysctls
# Try to set up NAT (may fail in Docker Desktop — routing still works with static routes)
echo "Configuring network..."
iptables -t nat -A POSTROUTING -s 10.8.0.0/16 -o eth1 -j MASQUERADE 2>/dev/null || true
iptables -A FORWARD -i tun0 -o eth1 -j ACCEPT 2>/dev/null || true
iptables -A FORWARD -i eth1 -o tun0 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true

# Start OpenVPN (if it fails, SSH keeps running)
echo "Starting OpenVPN..."
mkdir -p /dev/net
if [ ! -c /dev/net/tun ]; then
    mknod /dev/net/tun c 10 200 2>/dev/null || true
fi

openvpn --config "$SERVER_CONF" &
OVPN_PID=$!

# Wait for SSH — keeps container alive even if OpenVPN fails
wait $SSH_PID
