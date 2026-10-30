FROM nginx:alpine

# Le mecanisme officiel de l'image nginx (20-envsubst-on-templates.sh)
# transforme ce template en /etc/nginx/conf.d/default.conf au demarrage.
COPY docker/proxy/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
