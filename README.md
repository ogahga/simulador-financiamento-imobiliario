# Simulador de Financiamento SAC e PRICE com Banco de Dados

Este projeto é um simulador de financiamento que permite comparar os sistemas de amortização SAC e PRICE, incluindo simulações com amortizações extras. Agora com capacidade de salvar e carregar simulações em um banco de dados PostgreSQL.

## Recursos

- Simulação detalhada de financiamentos no sistema SAC e PRICE
- Adição de amortizações extras com suporte para redução de prazo ou parcela
- Cálculo automático de amortizações para atingir um prazo alvo
- Comparação entre sistemas SAC e PRICE
- Visualização gráfica da evolução do saldo devedor e parcelas
- Tabela completa mostrando todos os detalhes do financiamento mês a mês
- **NOVO**: Salvar e carregar simulações em banco de dados PostgreSQL

## Configuração Rápida

A maneira mais fácil de iniciar o projeto é usando o script `start-project.bat`:

1. Certifique-se de ter o Node.js instalado (versão 14 ou superior)
2. Execute o arquivo `start-project.bat` na pasta raiz do projeto
3. O script irá instalar todas as dependências e iniciar tanto o frontend quanto o backend

## Configuração Manual

### Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- Banco de dados PostgreSQL (já configurado)

### Configuração do Backend

1. Navegue até a pasta `server`:
   ```
   cd server
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Inicialize o banco de dados:
   ```
   npm run init-db
   ```

4. Inicie o servidor backend:
   ```
   npm start
   ```

### Configuração do Frontend

1. Na pasta raiz do projeto, instale as dependências:
   ```
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```
   npm start
   ```

3. Abra o navegador em [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

- `src/` - Código fonte do frontend React
  - `components/` - Componentes React
  - `services/` - Serviços para comunicação com API
  - `simulationUtils.js` - Funções principais de simulação
  - `LoanSimulator.js` - Componente principal do simulador

- `server/` - Código fonte do backend Node.js
  - `controllers/` - Controladores para as rotas da API
  - `db/` - Configuração e inicialização do banco de dados
  - `models/` - Modelos para acesso ao banco de dados
  - `routes/` - Definição das rotas da API

## Como Usar

1. Configure os parâmetros do financiamento (valor, prazo, taxas, etc.)
2. Adicione amortizações extras se desejar
3. Visualize os resultados nas tabelas e gráficos
4. Compare diferentes cenários usando as ferramentas disponíveis
5. Salve simulações para referência futura clicando no botão "Salvar Simulação"

## Licença

Este projeto está licenciado sob a licença MIT.