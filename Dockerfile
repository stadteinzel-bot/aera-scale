# Single-stage: copy pre-built dist into hardened Nginx
FROM nginx:alpine

# ── Security hardening ──
# Remove the default Nginx config before replacing it (avoids stale config)
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy pre-built dist into Nginx html directory with restricted permissions
COPY dist/ /usr/share/nginx/html/
RUN find /usr/share/nginx/html -type f -exec chmod 644 {} \; \
    && find /usr/share/nginx/html -type d -exec chmod 755 {} \;

# Copy custom Nginx configuration (read-only for security)
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod 444 /etc/nginx/conf.d/default.conf

# Copy env script (runtime variable injection at container start)
COPY env.sh /docker-entrypoint.d/40-env.sh
RUN chmod 755 /docker-entrypoint.d/40-env.sh

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Note: Nginx entrypoint.d scripts require root to run.
# File permissions are hardened above instead of switching user.
CMD ["nginx", "-g", "daemon off;"]
