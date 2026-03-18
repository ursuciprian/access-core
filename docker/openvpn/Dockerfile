FROM alpine:3.18

RUN apk add --no-cache \
    openvpn \
    easy-rsa \
    openssh-server \
    bash \
    iptables \
    openssl

# Setup SSH
RUN mkdir -p /root/.ssh && \
    ssh-keygen -A && \
    sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    echo "root:openvpn" | chpasswd

# Setup EasyRSA
RUN mkdir -p /etc/openvpn/easy-rsa && \
    ln -s /usr/share/easy-rsa/* /etc/openvpn/easy-rsa/ && \
    mkdir -p /etc/openvpn/ccd

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 1194/udp 22

ENTRYPOINT ["/entrypoint.sh"]
