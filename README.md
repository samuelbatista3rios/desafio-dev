# 🚀 Desafio Dev

Aplicação full stack desenvolvida como desafio técnico, com
autenticação, integração entre front-end e back-end e deploy em ambiente
real.

🔗 **Aplicação online:**\
👉 https://desafio-dev-lemon.vercel.app/login

------------------------------------------------------------------------

## 📌 Sobre o Projeto

Este projeto simula um fluxo de autenticação com separação clara entre
front-end e back-end, aplicando boas práticas de organização,
arquitetura e comunicação via API.

O objetivo foi construir uma aplicação estruturada, escalável e com
deploy funcional.

------------------------------------------------------------------------

## 🛠️ Tecnologias Utilizadas

### Front-end

-   React
-   TypeScript
-   Vite
-   TailwindCSS

### Back-end

-   NestJS
-   Node.js

### Deploy

-   Front-end: Vercel
-   Back-end: Render

------------------------------------------------------------------------

## ⚠️ Observação sobre o Back-end (Render)

O back-end está hospedado no plano gratuito do Render.\
Por conta disso, após um período de inatividade, o serviço pode entrar
em modo "sleep".

Quando isso acontece, a primeira requisição pode levar alguns segundos
para responder enquanto o servidor é "acordado" automaticamente.

Após essa primeira requisição, as respostas voltam ao tempo normal.

------------------------------------------------------------------------

## 🏗️ Estrutura do Projeto

desafio-dev/ │ ├── ui/ \# Front-end (React + Vite) └── api/ \# Back-end
(NestJS)

------------------------------------------------------------------------

## ⚙️ Como rodar o projeto localmente

### 1️⃣ Clonar o repositório

``` bash
git clone https://github.com/samuelbatista3rios/desafio-dev.git
cd desafio-dev
```

------------------------------------------------------------------------

### 2️⃣ Rodar o Back-end

``` bash
cd api
npm install
npm run start:dev
```

A API ficará disponível por padrão em:

http://localhost:3000

------------------------------------------------------------------------

### 3️⃣ Rodar o Front-end

``` bash
cd ui
npm install
npm run dev
```

O front ficará disponível em:

http://localhost:5173

------------------------------------------------------------------------

## 🔐 Funcionalidades

-   Tela de Login
-   Validação de credenciais
-   Integração com API REST
-   Tratamento de erros
-   Estrutura modular e organizada

------------------------------------------------------------------------

## 🧠 Decisões Técnicas

-   Uso de TypeScript para maior segurança e previsibilidade
-   Arquitetura modular no NestJS
-   Separação clara entre camadas (controller, service)
-   Deploy separado para front e back
-   Estrutura preparada para escalar funcionalidades

------------------------------------------------------------------------

## 🌐 Deploy

A aplicação está disponível publicamente:

👉 https://desafio-dev-lemon.vercel.app/login

Front-end hospedado na Vercel\
Back-end hospedado no Render

------------------------------------------------------------------------

## 👨‍💻 Autor

Samuel Batista\
Desenvolvedor Full Stack
