import {expect, test} from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {z} from 'zod';
import {stringifyDefaultProps} from '../codemods/stringify-with-path';
import {createZodValues} from '../editor/components/RenderModal/SchemaEditor/create-zod-values';
import {extractEnumJsonPaths} from '../editor/components/RenderModal/SchemaEditor/extract-enum-json-paths';

test('Should stringify default props correctly', () => {
	const result = stringifyDefaultProps({
		props: {
			abc: 'def',
			newDate: new Date('2022-01-02'),
		},
		enumPaths: [],
	});
	expect(result).toBe(
		`{"abc":"def","newDate":new Date('2022-01-02T00:00:00.000Z')}`
	);
});

test('Should stringify default props correctly', () => {
	const schema = z.object({
		abc: z.enum(['hi', 'there']),
		array: z.array(z.enum(['hi', 'there'])),
		notAnEnum: z.string(),
	});

	const values = createZodValues(schema, z, null);
	expect(values).toStrictEqual({
		abc: 'hi',
		array: ['hi'],
		notAnEnum: '',
	});
	const enumPaths = extractEnumJsonPaths(schema, z, []);
	expect(enumPaths).toStrictEqual([['abc'], ['array', '[]']]);

	const result = stringifyDefaultProps({props: values, enumPaths});
	expect(result).toBe(
		`{"abc":"hi" as const,"array":["hi" as const],"notAnEnum":""}`
	);
});
