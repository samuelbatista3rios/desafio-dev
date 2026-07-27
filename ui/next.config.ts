import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do Turbopack nesta pasta (ui). Sem isso, com múltiplos
  // lockfiles / o repo git na pasta pai, o Next infere a raiz errada e
  // falha ao resolver módulos como o tailwindcss em ui/node_modules.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
