// Règle de nommage de docs/Regles-ecriture-de-code.md : pas de nom laconique (`of`, `with`,
// `without`, `renamed`, `movedTo`). Un nom dit seul ce que fait la fonction.
const TERSE = /(?:Of|With|Without)$|^(?:of|with|without|renamed|movedTo)(?:[A-Z]|$)/;

/** Le nom déclaré d'une fonction, d'une méthode ou d'une constante qui reçoit une fonction. */
function declaredName(node) {
  if (node.type === 'FunctionDeclaration') return node.id;
  if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') {
    if (node.type === 'PropertyDefinition') {
      const value = node.value?.type;
      if (value !== 'ArrowFunctionExpression' && value !== 'FunctionExpression') return null;
    }
    return node.key.type === 'Identifier' ? node.key : null;
  }
  if (node.type === 'VariableDeclarator') {
    const init = node.init?.type;
    if (init !== 'ArrowFunctionExpression' && init !== 'FunctionExpression') return null;
    return node.id.type === 'Identifier' ? node.id : null;
  }
  return null;
}

const noTerseName = {
  meta: {
    type: 'suggestion',
    messages: {
      terse:
        '« {{name}} » est un nom laconique : un nom de fonction dit ce qu’elle fait (docs/Regles-ecriture-de-code.md).',
    },
  },
  create(context) {
    const check = (node) => {
      const id = declaredName(node);
      if (id && TERSE.test(id.name)) {
        context.report({ node: id, messageId: 'terse', data: { name: id.name } });
      }
    };
    return {
      FunctionDeclaration: check,
      MethodDefinition: check,
      PropertyDefinition: check,
      VariableDeclarator: check,
    };
  },
};

export default {
  meta: { name: 'chimeres' },
  rules: { 'no-terse-name': noTerseName },
};
