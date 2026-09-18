FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/zabardast-entrypoint

COPY *.html /usr/share/nginx/html/
COPY Views /usr/share/nginx/html/Views
COPY Scripts /usr/share/nginx/html/Scripts
COPY Styles /usr/share/nginx/html/Styles
COPY Icons /usr/share/nginx/html/Icons

RUN chmod 0555 /usr/local/bin/zabardast-entrypoint \
    && mkdir -p /tmp/runtime-config /tmp/nginx \
    && chown -R 101:101 /tmp/runtime-config /tmp/nginx

USER 101

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/zabardast-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
