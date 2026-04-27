FROM node:18

# Pasta de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o resto do projeto
COPY . .

# Porta (opcional, depende do teu app)
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
