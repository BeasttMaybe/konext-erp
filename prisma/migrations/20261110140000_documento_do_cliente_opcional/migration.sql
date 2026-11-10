-- CPF/CNPJ deixa de ser obrigatorio no cadastro de cliente.
--
-- Decisao do dono: "mantenha obrigatorio apenas nome e telefone". Quem
-- atende no balcao nem sempre tem o documento na hora, e exigir um campo
-- que a pessoa nao tem leva ao pior dos mundos: alguem digita qualquer
-- coisa so para passar da tela, e o cadastro fica com um documento falso
-- que ninguem sabe que e falso.
--
-- POR QUE NULO, E NAO STRING VAZIA
--
-- A coluna e UNIQUE. No Postgres, varios NULL convivem sob um indice unico,
-- mas varias strings vazias nao: o segundo cliente sem documento seria
-- recusado com erro de duplicidade.
--
-- NAO E DESTRUTIVA: afrouxar NOT NULL nao apaga nem altera linha nenhuma.
-- As que ja tem documento continuam exatamente como estao.

ALTER TABLE "Cliente" ALTER COLUMN "documento" DROP NOT NULL;
