# Arpen · Viabilidade e Propostas

Sistema React + Vite para estudo de viabilidade de contratos de serviços médicos e emissão de propostas.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera /dist para publicar em qualquer servidor estático
npm run build:single  # gera dist-single/index.html (arquivo único, abre direto no navegador)
```

## Fluxo

1. **Clientes** – cadastro (nome, setor do hospital, telefone, contato) no banco interno.
2. **Viabilidade** – etapas:
   - Impostos: ISS, PIS, COFINS, CSLL e IR (%)
   - Despesas administrativas (R$/mês)
   - Margens: mínima informada; mediana e máxima com variação de 1,2 (p.p. ou multiplicador)
   - Especialidades: 55 especialidades do CFM com botões **COM RQE** / **COM PÓS**; cada uma vira uma linha com horas e valor/hora a pagar (também aceita itens livres, ex.: Coordenação)
   - Resultado: custo total, valor hora a faturar e faturamento total por meta (mínima + botões para adicionar mediana e máxima)
   - **Salvar e confirmar**
3. **Histórico** – por cliente, com edição (gera nova versão), download em Excel e **Emitir proposta** (modelo da aba "proposta": Custos operacionais, Taxas e impostos, Custo total, Taxa de administração e lucro, Valor total mensal), com impressão/PDF e Excel.

## Fórmula

```
Faturamento  = (Custo médico + Despesas adm.) / (1 − %tributos − %margem)
Hora faturar = Hora a pagar × (Faturamento / Custo médico)
Lucro        = Faturamento − Tributos − Custo − Despesas adm. = %margem × Faturamento
```

## Dados

Os dados ficam no `localStorage` do navegador (chave `arpen-viabilidade-db-v1`). Use "Exportar backup (.json)" no rodapé para guardar uma cópia.
Para uso multiusuário, troque `src/lib/storage.js` por chamadas a uma API/banco.
