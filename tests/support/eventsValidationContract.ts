import ts from 'typescript';
import { z } from 'zod';

const contractSchema = z
  .object({
    labelMaxLength: z.number().int().positive(),
    descriptionMaxLength: z.number().int().positive(),
    icons: z.array(z.string()).nonempty(),
  })
  .strict()
  .refine((contract) => new Set(contract.icons).size === contract.icons.length, {
    message: 'Icon values must be unique',
  });

export type EventsValidationContract = z.infer<typeof contractSchema>;

/** Read exactly one tagged SQL literal; malformed or unsupported JSON is fatal. */
export function extractEventsValidationContract(sql: string): EventsValidationContract {
  const parts = sql.split('$events_validation_contract$');
  if (parts.length !== 3) {
    throw new Error('Expected exactly one tagged events validation contract in the pgTAP SQL');
  }
  return contractSchema.parse(JSON.parse(parts[1]));
}

/** Inspect declarations without importing production code or evaluating expressions. */
export function extractEventsFormDeclarations(source: string): EventsValidationContract {
  const { diagnostics = [] } = ts.transpileModule(source, {
    fileName: 'EventsSettings.tsx',
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext },
  });
  if (diagnostics.length > 0) {
    throw new Error(
      `Could not parse EventsSettings.tsx: ${diagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('; ')}`
    );
  }

  const file = ts.createSourceFile(
    'EventsSettings.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
  );

  function initializer(name: string): ts.Expression {
    const declarations = file.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) =>
        statement.declarationList.declarations
          .filter((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name)
          .map((declaration) => ({ declaration, flags: statement.declarationList.flags }))
      );
    if (declarations.length !== 1) {
      throw new Error(`Expected exactly one top-level ${name} declaration`);
    }
    const { declaration, flags } = declarations[0];
    if (!(flags & ts.NodeFlags.Const) || !declaration.initializer) {
      throw new Error(`Unsupported ${name}: expected an initialized const declaration`);
    }
    return declaration.initializer;
  }

  function limit(name: string): number {
    const value = initializer(name);
    if (!ts.isNumericLiteral(value)) {
      throw new Error(`Unsupported ${name}: expected a numeric literal`);
    }
    return Number(value.text);
  }

  const options = initializer('ICON_OPTIONS');
  if (!ts.isArrayLiteralExpression(options)) {
    throw new Error('Unsupported ICON_OPTIONS: expected an array literal');
  }
  const icons = options.elements.map((option, index) => {
    if (!ts.isObjectLiteralExpression(option)) {
      throw new Error(`Unsupported ICON_OPTIONS[${index}]: expected an object literal`);
    }
    const values: ts.Expression[] = [];
    for (const property of option.properties) {
      // A spread, getter or computed key can replace a value. Do not skip it.
      if (
        !ts.isPropertyAssignment(property) ||
        (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
      ) {
        throw new Error(`Unsupported ICON_OPTIONS[${index}]: expected plain named properties`);
      }
      if (property.name.text === 'value') values.push(property.initializer);
    }
    if (values.length !== 1 || !ts.isStringLiteral(values[0])) {
      throw new Error(`Unsupported ICON_OPTIONS[${index}].value: expected exactly one string literal`);
    }
    // TypeScript decodes escaped quotes, backslashes and Unicode in either quote style.
    return values[0].text;
  });

  return contractSchema.parse({
    labelMaxLength: limit('LABEL_MAX_LENGTH'),
    descriptionMaxLength: limit('DESCRIPTION_MAX_LENGTH'),
    icons,
  });
}
