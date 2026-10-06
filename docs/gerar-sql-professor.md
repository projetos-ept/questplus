# Gerar o SQL do primeiro professor e o JWT_SECRET (só com o navegador)

Faça isto **você mesmo**, numa aba em branco (`about:blank`), nunca pela extensão: a senha não deve passar por ela.
Abra o console (F12 → Console). O Chrome pode pedir para digitar `allow pasting` antes de colar.

## 1. SQL do professor

Cole, responda os dois pop-ups (e-mail e senha) e copie a linha `INSERT ...;` impressa. Ela contém só o hash.

```js
(async () => {
  const email = prompt('E-mail do professor:');
  const senha = prompt('Senha (mínimo 10 caracteres):');
  if (!email || !senha || senha.length < 10) return console.log('Cancelado ou senha curta.');
  const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, chave, 256);
  const q = (s) => s.replace(/'/g, "''");
  console.log(`INSERT INTO usuarios (email, senha_hash, papel) VALUES ('${q(email.trim())}', 'pbkdf2$100000$${b64(sal)}$${b64(bits)}', 'admin');`);
})();
```

## 2. Valor do JWT_SECRET

```js
console.log(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
```

Cole o resultado direto no campo do secret no dashboard. Não o envie por chat.
