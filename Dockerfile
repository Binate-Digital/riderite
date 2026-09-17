FROM node:22

WORKDIR /app

EXPOSE 8080

#CMD tail -f /dev/null

CMD ["npm", "run", "dev"]
