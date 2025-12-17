# ---------- Build stage ----------
FROM node:18-alpine AS build

WORKDIR /app

# nhận biến môi trường lúc build
ARG VITE_GOOGLE_API_KEY
ENV VITE_GOOGLE_API_KEY=AIzaSyCVlwe3nR6YzM3pGmhlMSQ3_T4pU8N1DNM

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
