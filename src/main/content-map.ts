import type { DraftScope } from '../shared/drafts';
import { parseContentMap, type ContentMap } from '../shared/content-map';
import { isSampleSelection } from '../shared/sample';
import type { ConnectionService } from './domain/connection-service';
import { parseJson } from './domain/draft-service';

export async function readContentMap(
  connection: Pick<ConnectionService, 'verify' | 'run'>,
  scope: DraftScope
): Promise<ContentMap> {
  if (isSampleSelection(scope.selection)) {
    const prefix = scope.path.endsWith('/') ? scope.path : `${scope.path}/`;
    return {
      page: scope.path,
      themeId: 1,
      template: '/themes/Fieldwork/sample.vm',
      sources: [
        {
          file: `${prefix}body.cjson`,
          kind: 'page container',
          reached: true,
          slot: 'body',
          via: ['Local sample renderer'],
        },
      ],
      warnings: ['Illustrative sample. Connected stores are inspected through their resolved templates.'],
      notFollowed: [],
      checkedAt: new Date().toISOString(),
      sample: true,
    };
  }
  await connection.verify(scope.selection);
  // A selector without a widget ID still returns the bounded template and slot map.
  const raw = await connection.run(
    [
      '--format',
      'json',
      '--profile',
      scope.selection.profileId,
      'sf',
      'locate',
      'html',
      '--storefront',
      String(scope.selection.storefront.id),
      '--uri',
      scope.path,
    ],
    { acceptedExitCodes: [0, 1] }
  );
  const result = parseContentMap(parseJson(raw, 'The toolkit returned an unreadable content map.'), scope);
  await connection.verify(scope.selection);
  return result;
}
