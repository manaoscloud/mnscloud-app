import { layoutMessageText, messageBlocks } from './message-layout';

describe('message layout', () => {
  it('puts inline numbered questions on their own lines', () => {
    expect(
      messageBlocks(
        'Olá! Pode nos confirmar: 1) O módulo consta? 2) Quando começou? 3) Todos os usuários?\n\nMensagem do assistente.',
      ),
    ).toEqual([
      { kind: 'paragraph', lines: ['Olá! Pode nos confirmar:'] },
      { kind: 'ordered', items: ['O módulo consta?', 'Quando começou?', 'Todos os usuários?'] },
      { kind: 'paragraph', lines: ['Mensagem do assistente.'] },
    ]);
  });

  it('keeps numbers that are not an ordered list and line breaks inside a paragraph', () => {
    const text = 'Atualize para a versão 2. Depois reinicie 1) uma vez.';
    expect(layoutMessageText(text)).toBe(text);
    expect(messageBlocks('a\nb\n\n- x\n- y')).toEqual([
      { kind: 'paragraph', lines: ['a', 'b'] },
      { kind: 'bullets', items: ['x', 'y'] },
    ]);
  });
});
