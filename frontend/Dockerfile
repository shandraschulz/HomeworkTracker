# Frontend Dockerfile (Nginx-based)
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend files
COPY tracker.html /usr/share/nginx/html/index.html
COPY tracker.css /usr/share/nginx/html/tracker.css
COPY tracker.js /usr/share/nginx/html/tracker.js

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
