FROM nginx:alpine

# Remove a configuração padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia o arquivo de configuração customizado
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia todos os arquivos do projeto para o diretório de serviço do nginx
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
