import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import './App.css'

type FieldNode = {
  name: string
  children: FieldNode[]
  args: Record<string, string | number | boolean>
}

type SchemaNode = {
  name: string
  children?: SchemaNode[]
}

type Post = {
  id: string
  title: string
  likes: number
  published: boolean
}

type MockRow = {
  id: string
  name: string
  role: string
  level: number
  points: number
  title: string
  likes: number
  published: boolean
}

type QueryResult = {
  data?: unknown
  error?: string
}

const schema: SchemaNode[] = [
  {
    name: 'user',
    children: [
      { name: 'id' },
      { name: 'name' },
      { name: 'role' },
      { name: 'level' },
      { name: 'points' },
      {
        name: 'posts',
        children: [
          { name: 'id' },
          { name: 'title' },
          { name: 'likes' },
          { name: 'published' },
        ],
      },
    ],
  },
  {
    name: 'posts',
    children: [
      { name: 'id' },
      { name: 'title' },
      { name: 'likes' },
      { name: 'published' },
    ],
  },
  {
    name: 'stats',
    children: [
      { name: 'totalPosts' },
      { name: 'avgLikes' },
      { name: 'activeReaders' },
      { name: 'featuredTopic' },
    ],
  },
]

const defaultSelected: Record<string, boolean> = {
  'user.name': true,
  'user.level': true,
  'user.posts.title': true,
  'posts.id': true,
  'posts.likes': true,
  'stats.totalPosts': true,
}

const sampleTopics = ['Apollo', 'Caching', 'Fragments', 'Unions', 'Federation']
const firstNames = ['Nina', 'Omar', 'Lara', 'Mateo', 'Sofia', 'Iris', 'Noah', 'Emma', 'Viktor', 'Mina']
const lastNames = ['Stone', 'Klein', 'Novak', 'Reed', 'Costa', 'Lin', 'Meyer', 'Zhang', 'Khan', 'Duran']
const sampleRoles = ['frontend explorer', 'api integrator', 'mobile dev', 'product engineer', 'graphql trainee']

function buildSelection(
  nodes: SchemaNode[],
  selected: Record<string, boolean>,
  postsArgs = '',
  parentPath = '',
): string[] {
  const blocks: string[] = []

  for (const node of nodes) {
    const path = parentPath ? `${parentPath}.${node.name}` : node.name

    if (!node.children || node.children.length === 0) {
      if (selected[path]) {
        blocks.push(node.name)
      }
      continue
    }

    const childBlocks = buildSelection(node.children, selected, postsArgs, path)
    if (childBlocks.length > 0) {
      const argsPart = node.name === 'posts' ? postsArgs : ''
      blocks.push(`${node.name}${argsPart} { ${childBlocks.join(' ')} }`)
    }
  }

  return blocks
}

function createPostsArgsString(options: {
  minLikes: number
  publishedOnly: boolean
  orderBy: string
  limit: number
}): string {
  const args: string[] = []

  if (options.minLikes > 0) {
    args.push(`minLikes: ${options.minLikes}`)
  }
  if (options.publishedOnly) {
    args.push('published: true')
  }
  if (options.orderBy !== 'NONE') {
    args.push(`orderBy: ${options.orderBy}`)
  }
  if (options.limit > 0) {
    args.push(`limit: ${options.limit}`)
  }

  return args.length > 0 ? `(${args.join(', ')})` : ''
}

function createQueryFromSelection(selected: Record<string, boolean>, postsArgs = ''): string {
  const blocks = buildSelection(schema, selected, postsArgs)
  if (blocks.length === 0) {
    return '{\n  stats { totalPosts }\n}'
  }

  return `query LearnGraphQL {\n  ${blocks.join('\n  ')}\n}`
}

function tokenize(query: string): string[] {
  const cleaned = query
    .replace(/#.*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned.match(/[A-Za-z_][A-Za-z0-9_]*|-?\d+|"[^"]*"|[{}():,]/g) ?? []
}

function parseArgValue(token: string): string | number | boolean {
  if (token === 'true') {
    return true
  }
  if (token === 'false') {
    return false
  }
  if (/^-?\d+$/.test(token)) {
    return Number(token)
  }
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1)
  }
  return token
}

function parseQuery(query: string): { ast: FieldNode[]; error?: string } {
  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return { ast: [], error: 'Query is empty.' }
  }

  const firstBrace = tokens.indexOf('{')
  if (firstBrace === -1) {
    return { ast: [], error: 'Query must contain a selection set in curly braces.' }
  }

  let i = firstBrace

  function parseSelectionSet(): FieldNode[] {
    if (tokens[i] !== '{') {
      throw new Error('Expected opening {')
    }
    i += 1
    const fields: FieldNode[] = []

    while (i < tokens.length && tokens[i] !== '}') {
      const name = tokens[i]
      if (!name || name === '{' || name === '}') {
        throw new Error('Invalid field name.')
      }
      i += 1

      const args: Record<string, string | number | boolean> = {}
      if (tokens[i] === '(') {
        i += 1
        while (i < tokens.length && tokens[i] !== ')') {
          const argName = tokens[i]
          if (!argName || argName === ':' || argName === ',' || argName === ')' || argName === '(') {
            throw new Error('Invalid argument name.')
          }
          i += 1
          if (tokens[i] !== ':') {
            throw new Error('Expected : in argument list.')
          }
          i += 1

          const valueToken = tokens[i]
          if (!valueToken || valueToken === ')' || valueToken === ',' || valueToken === ':') {
            throw new Error(`Missing value for argument ${argName}.`)
          }

          args[argName] = parseArgValue(valueToken)
          i += 1

          if (tokens[i] === ',') {
            i += 1
          }
        }

        if (tokens[i] !== ')') {
          throw new Error('Missing closing ) in arguments.')
        }
        i += 1
      }

      let children: FieldNode[] = []
      if (tokens[i] === '{') {
        children = parseSelectionSet()
      }

      fields.push({ name, children, args })
    }

    if (tokens[i] !== '}') {
      throw new Error('Missing closing }')
    }
    i += 1
    return fields
  }

  try {
    const ast = parseSelectionSet()
    return { ast }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cannot parse query.'
    return { ast: [], error: message }
  }
}

function applyArrayArgs<T extends Record<string, unknown>>(
  items: T[],
  args: Record<string, string | number | boolean>,
): T[] {
  let output = [...items]

  const minLikes = args.minLikes
  if (typeof minLikes === 'number') {
    output = output.filter((item) => {
      const likes = item.likes
      return typeof likes === 'number' ? likes >= minLikes : true
    })
  }

  const published = args.published
  if (typeof published === 'boolean') {
    output = output.filter((item) => {
      const value = item.published
      return typeof value === 'boolean' ? value === published : true
    })
  }

  const orderBy = args.orderBy
  if (typeof orderBy === 'string') {
    if (orderBy === 'LIKES_ASC') {
      output.sort((a, b) => Number(a.likes ?? 0) - Number(b.likes ?? 0))
    } else if (orderBy === 'LIKES_DESC') {
      output.sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0))
    } else if (orderBy === 'TITLE_ASC') {
      output.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')))
    } else if (orderBy === 'TITLE_DESC') {
      output.sort((a, b) => String(b.title ?? '').localeCompare(String(a.title ?? '')))
    }
  }

  const limit = args.limit
  if (typeof limit === 'number' && limit >= 0) {
    output = output.slice(0, limit)
  }

  return output
}

function collectPostsArgs(nodes: FieldNode[]): Array<Record<string, string | number | boolean>> {
  const argsList: Array<Record<string, string | number | boolean>> = []
  for (const node of nodes) {
    if (node.name === 'posts') {
      argsList.push(node.args)
    }
    if (node.children.length > 0) {
      argsList.push(...collectPostsArgs(node.children))
    }
  }
  return argsList
}

function projectNode(source: unknown, node: FieldNode): unknown {
  if (source === null || source === undefined) {
    return null
  }

  if (Array.isArray(source)) {
    const arraySource = source as Array<Record<string, unknown>>
    const filtered = applyArrayArgs(arraySource, node.args)
    return filtered.map((item) => projectNode(item, node))
  }

  if (typeof source !== 'object') {
    return source
  }

  const record = source as Record<string, unknown>
  const value = record[node.name]

  if (node.children.length === 0) {
    return value
  }

  if (Array.isArray(value)) {
    const filtered = applyArrayArgs(value as Array<Record<string, unknown>>, node.args)
    return filtered.map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return entry
      }
      const out: Record<string, unknown> = {}
      for (const child of node.children) {
        out[child.name] = projectNode(entry, child)
      }
      return out
    })
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  const nested: Record<string, unknown> = {}
  for (const child of node.children) {
    nested[child.name] = projectNode(value, child)
  }
  return nested
}

function executeQuery(query: string, root: Record<string, unknown>): QueryResult {
  const parsed = parseQuery(query)
  if (parsed.error) {
    return { error: parsed.error }
  }

  const data: Record<string, unknown> = {}

  for (const node of parsed.ast) {
    if (!(node.name in root)) {
      return { error: `Unknown root field: ${node.name}` }
    }

    const rootValue = root[node.name]
    if (node.children.length === 0) {
      data[node.name] = rootValue
      continue
    }

    if (Array.isArray(rootValue)) {
      const filtered = applyArrayArgs(rootValue as Array<Record<string, unknown>>, node.args)
      data[node.name] = filtered.map((item) => {
        const projected: Record<string, unknown> = {}
        for (const child of node.children) {
          projected[child.name] = projectNode(item, child)
        }
        return projected
      })
      continue
    }

    if (typeof rootValue !== 'object' || rootValue === null) {
      data[node.name] = rootValue
      continue
    }

    const projected: Record<string, unknown> = {}
    for (const child of node.children) {
      projected[child.name] = projectNode(rootValue, child)
    }
    data[node.name] = projected
  }

  return { data }
}

function countFields(nodes: FieldNode[]): number {
  let total = 0
  for (const node of nodes) {
    total += 1
    total += countFields(node.children)
  }
  return total
}

function diagramRows(nodes: FieldNode[], depth = 0): Array<{ label: string; depth: number }> {
  const rows: Array<{ label: string; depth: number }> = []
  for (const node of nodes) {
    rows.push({ label: node.name, depth })
    rows.push(...diagramRows(node.children, depth + 1))
  }
  return rows
}

function findNodeByName(nodes: SchemaNode[], name: string): SchemaNode | undefined {
  return nodes.find((node) => node.name === name)
}

function buildBuilderGroups(rootNode: SchemaNode): Array<{ label: string; fields: Array<{ path: string; label: string }> }> {
  const groups: Array<{ label: string; fields: Array<{ path: string; label: string }> }> = []
  const rootPath = rootNode.name
  const directFields: Array<{ path: string; label: string }> = []

  for (const child of rootNode.children ?? []) {
    if (!child.children || child.children.length === 0) {
      directFields.push({ path: `${rootPath}.${child.name}`, label: child.name })
      continue
    }

    groups.push({
      label: `${child.name} fields`,
      fields: child.children.map((grandChild) => ({
        path: `${rootPath}.${child.name}.${grandChild.name}`,
        label: `${child.name}.${grandChild.name}`,
      })),
    })
  }

  if (directFields.length > 0) {
    groups.unshift({ label: `${rootPath} fields`, fields: directFields })
  }

  return groups
}

function isPostsRequested(ast: FieldNode[]): boolean {
  for (const root of ast) {
    if (root.name === 'posts' && root.children.length > 0) {
      return true
    }
    if (root.name === 'user') {
      const nestedPostsRequested = root.children.some(
        (child) => child.name === 'posts' && child.children.length > 0,
      )
      if (nestedPostsRequested) {
        return true
      }
    }
  }
  return false
}

function createMockRows(
  count: number,
  likesBase: number,
  levelBias: number,
  pointsBase: number,
): MockRow[] {
  return Array.from({ length: count }).map((_, index) => {
    const level = ((index + levelBias) % 7) + 1
    const first = firstNames[index % firstNames.length]
    const last = lastNames[(index * 3) % lastNames.length]
    const role = sampleRoles[(index + levelBias) % sampleRoles.length]
    const topic = sampleTopics[(index * 2) % sampleTopics.length]
    const likes = Math.max(0, likesBase + ((index * 7) % 80) + level * 2)

    return {
      id: `r-${index + 1}`,
      name: `${first} ${last}`,
      role,
      level,
      points: pointsBase + level * 45 + (index % 4) * 16,
      title: `${topic} patterns #${index + 1}`,
      likes,
      published: index % 3 !== 1,
    }
  })
}

function rowsToPosts(rows: MockRow[]): Post[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    likes: row.likes,
    published: row.published,
  }))
}

function App() {
  const [selected, setSelected] = useState<Record<string, boolean>>(defaultSelected)
  const [query, setQuery] = useState<string>(() => createQueryFromSelection(defaultSelected))
  const [autoSync, setAutoSync] = useState(true)
  const [activeRoot, setActiveRoot] = useState('user')
  const [builderMinLikes, setBuilderMinLikes] = useState(50)
  const [builderOnlyPublished, setBuilderOnlyPublished] = useState(false)
  const [builderOrderBy, setBuilderOrderBy] = useState('NONE')
  const [builderLimit, setBuilderLimit] = useState(0)
  const [showDiagram, setShowDiagram] = useState(false)
  const [showDatasourceControls, setShowDatasourceControls] = useState(false)
  const [rowCount, setRowCount] = useState(20)
  const [likesBase, setLikesBase] = useState(12)
  const [levelBias, setLevelBias] = useState(0)
  const [pointsBase, setPointsBase] = useState(120)

  const mockRows = useMemo<MockRow[]>(
    () => createMockRows(rowCount, likesBase, levelBias, pointsBase),
    [rowCount, likesBase, levelBias, pointsBase],
  )
  const sourcePosts = useMemo<Post[]>(() => rowsToPosts(mockRows), [mockRows])
  const postsArgs = useMemo(
    () =>
      createPostsArgsString({
        minLikes: builderMinLikes,
        publishedOnly: builderOnlyPublished,
        orderBy: builderOrderBy,
        limit: builderLimit,
      }),
    [builderMinLikes, builderOnlyPublished, builderOrderBy, builderLimit],
  )

  const rootData = useMemo<Record<string, unknown>>(() => {
    const sourceUser = mockRows[0]
    const user = {
      id: 'u-1',
      name: sourceUser?.name ?? 'Unknown User',
      role: sourceUser?.role ?? 'unknown',
      level: sourceUser?.level ?? 1,
      points: sourceUser?.points ?? 0,
      posts: sourcePosts,
    }

    const stats = {
      totalPosts: sourcePosts.length,
      avgLikes:
        sourcePosts.length === 0
          ? 0
          : Math.round(sourcePosts.reduce((sum, p) => sum + p.likes, 0) / sourcePosts.length),
      activeReaders: 110 + (sourceUser?.level ?? 1) * 19,
      featuredTopic: sampleTopics[((sourceUser?.level ?? 1) - 1 + sampleTopics.length) % sampleTopics.length],
    }

    return {
      user,
      posts: sourcePosts,
      stats,
    }
  }, [sourcePosts, mockRows])

  useEffect(() => {
    if (!autoSync) {
      return
    }
    setQuery(createQueryFromSelection(selected, postsArgs))
  }, [selected, autoSync, postsArgs])

  const parsed = useMemo(() => parseQuery(query), [query])
  const result = useMemo(() => executeQuery(query, rootData), [query, rootData])
  const resultText = result.error ? result.error : JSON.stringify(result.data, null, 2)
  const payloadSize = result.error ? 0 : new Blob([resultText]).size
  const selectedCount = parsed.error ? 0 : countFields(parsed.ast)
  const rows = parsed.error ? [] : diagramRows(parsed.ast)
  const rootNames = useMemo(() => schema.map((node) => node.name), [])
  const activeRootNode = findNodeByName(schema, activeRoot) ?? schema[0]
  const builderGroups = buildBuilderGroups(activeRootNode)
  const postsRequested = parsed.error ? false : isPostsRequested(parsed.ast)
  const postsArgsList = useMemo(
    () => (parsed.error ? [] : collectPostsArgs(parsed.ast)),
    [parsed.error, parsed.ast],
  )
  const servedIds = useMemo(() => {
    if (!postsRequested) {
      return new Set<string>()
    }

    const ids = new Set<string>()
    const argSets = postsArgsList.length > 0 ? postsArgsList : [{}]
    for (const args of argSets) {
      const matched = applyArrayArgs(mockRows, args)
      for (const row of matched) {
        ids.add(row.id)
      }
    }
    return ids
  }, [postsRequested, postsArgsList, mockRows])
  const frontendSnippet = useMemo(
    () =>
      [
        "import { request } from 'graphql-request'",
        "",
        "const endpoint = 'https://your-api.com/graphql'",
        `const query = \`${query}\``,
        "const data = await request(endpoint, query)",
      ].join('\n'),
    [query],
  )

  const backendSnippet = [
    "import { createServer } from 'node:http'",
    "import { createSchema, createYoga } from 'graphql-yoga'",
    "",
    'const yoga = createYoga({',
    '  schema: createSchema({',
    '    typeDefs: `type Query { user: User posts: [Post!]! stats: Stats! } ...`',
    '    resolvers: { Query: { user: () => mockUser, posts: () => mockPosts, stats: () => mockStats } }',
    '  })',
    '})',
    'createServer(yoga).listen(4000)',
  ].join('\n')

  function toggleField(path: string): void {
    setSelected((prev) => ({
      ...prev,
      [path]: !prev[path],
    }))
  }

  return (
    <main className="app-shell">
      <div className="bg-orb orb-a" aria-hidden="true" />
      <div className="bg-orb orb-b" aria-hidden="true" />

      <header className="hero">
        <p className="badge">GraphQL Tiny Lab</p>
        <h1>Learn GraphQL by shaping live data in a playful visual lab</h1>
        <p>
          Move through 3 compact steps: pick fields, watch the diagram adapt, then read the exact JSON payload GraphQL returns.
        </p>
      </header>

      <section className="steps" aria-label="Learning steps">
        <article>
          <h2>1. Pick Fields</h2>
          <p>Use the visual schema tree to choose exactly what you need.</p>
        </article>
        <article>
          <h2>2. Read The Shape</h2>
          <p>The animated diagram mirrors your query structure in real time.</p>
        </article>
        <article>
          <h2>3. Compare Result</h2>
          <p>Inspect output JSON and understand how GraphQL removes overfetching.</p>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="panel builder-panel">
          <div className="panel-head">
            <h3>Visual Query Builder</h3>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setAutoSync(true)
                setQuery(createQueryFromSelection(selected, postsArgs))
              }}
            >
              Regenerate query
            </button>
          </div>

          <div className="root-tabs" role="tablist" aria-label="Select root field">
            {rootNames.map((name) => (
              <button
                key={name}
                type="button"
                className={name === activeRoot ? 'root-tab active' : 'root-tab'}
                onClick={() => setActiveRoot(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="schema-wrapper compact">
            {builderGroups.map((group) => (
              <section key={group.label} className="field-group">
                <p className="branch">{group.label}</p>
                <div className="field-chip-grid">
                  {group.fields.map((field) => (
                    <button
                      key={field.path}
                      type="button"
                      className={selected[field.path] ? 'field-chip active' : 'field-chip'}
                      onClick={() => toggleField(field.path)}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="builder-args">
            <h4>Posts Query Arguments</h4>

            <label htmlFor="builder-min-likes">minLikes: {builderMinLikes}</label>
            <input
              id="builder-min-likes"
              type="range"
              min={0}
              max={120}
              step={2}
              value={builderMinLikes}
              onChange={(event) => {
                setAutoSync(true)
                setBuilderMinLikes(Number(event.target.value))
              }}
            />

            <label className="checkbox-line" htmlFor="builder-published-only">
              <input
                id="builder-published-only"
                type="checkbox"
                checked={builderOnlyPublished}
                onChange={(event) => {
                  setAutoSync(true)
                  setBuilderOnlyPublished(event.target.checked)
                }}
              />
              <span>published: true</span>
            </label>

            <label htmlFor="builder-order-by">orderBy</label>
            <select
              id="builder-order-by"
              value={builderOrderBy}
              onChange={(event) => {
                setAutoSync(true)
                setBuilderOrderBy(event.target.value)
              }}
            >
              <option value="NONE">NONE</option>
              <option value="LIKES_ASC">LIKES_ASC</option>
              <option value="LIKES_DESC">LIKES_DESC</option>
              <option value="TITLE_ASC">TITLE_ASC</option>
              <option value="TITLE_DESC">TITLE_DESC</option>
            </select>

            <label htmlFor="builder-limit">limit: {builderLimit}</label>
            <input
              id="builder-limit"
              type="range"
              min={0}
              max={20}
              step={1}
              value={builderLimit}
              onChange={(event) => {
                setAutoSync(true)
                setBuilderLimit(Number(event.target.value))
              }}
            />
          </section>

          <label className="field-label" htmlFor="query-input">
            Query editor (this is the GraphQL request payload)
          </label>
          <textarea
            id="query-input"
            value={query}
            onChange={(event) => {
              setAutoSync(false)
              setQuery(event.target.value)
            }}
          />
          <p className="hint">
            Tip: try <code>posts(minLikes: 50, published: true, orderBy: LIKES_DESC, limit: 5)</code> to filter/sort using query arguments.
          </p>

          <section className="inline-diagram">
            <div className="panel-head">
              <h3>Adaptive Query Diagram (optional)</h3>
              <button
                type="button"
                className="ghost"
                onClick={() => setShowDiagram((prev) => !prev)}
              >
                {showDiagram ? 'Hide diagram' : 'Show diagram'}
              </button>
            </div>

            {showDiagram ? (
              <>
                {parsed.error ? <p className="error">Parse issue: {parsed.error}</p> : null}
                <div className="diagram-grid">
                  {rows.length > 0 ? (
                    rows.map((row, index) => (
                      <div
                        key={`${row.label}-${index}`}
                        className="diagram-node"
                        style={{ '--depth': row.depth, '--delay': `${index * 70}ms` } as CSSProperties}
                      >
                        <span className="connector" aria-hidden="true" />
                        <span>{row.label}</span>
                      </div>
                    ))
                  ) : (
                    <p className="hint">Write a query to visualize your field graph.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="hint">Query editor is enough for normal usage. Open the diagram only when you want a visual map of nesting.</p>
            )}
          </section>

          <section className="quickstart">
            <h4>Quick Start: Use this query in a real app</h4>
            <ol>
              <li>Install frontend packages: <code>pnpm add graphql graphql-request</code></li>
              <li>Copy this frontend snippet and call your GraphQL endpoint:</li>
            </ol>
            <pre>{frontendSnippet}</pre>
            <p className="hint">3) On backend, expose a GraphQL /graphql endpoint that resolves user, posts and stats.</p>
            <pre>{backendSnippet}</pre>
          </section>
        </article>

        <article className="panel mock-panel">
          <h3>Mocking</h3>
          <p>This is the datasource used by GraphQL. Table always shows all raw generated rows.</p>

          <div className="panel-head">
            <h4>Datasource Controls (optional)</h4>
            <button
              type="button"
              className="ghost"
              onClick={() => setShowDatasourceControls((prev) => !prev)}
            >
              {showDatasourceControls ? 'Hide controls' : 'Show controls'}
            </button>
          </div>

          {showDatasourceControls ? (
            <div className="mock-controls-grid">
              <label htmlFor="rows-range">Rows: {rowCount}</label>
              <input
                id="rows-range"
                type="range"
                min={8}
                max={40}
                step={1}
                value={rowCount}
                onChange={(event) => setRowCount(Number(event.target.value))}
              />

              <label htmlFor="likes-base">Likes base: {likesBase}</label>
              <input
                id="likes-base"
                type="range"
                min={0}
                max={80}
                step={2}
                value={likesBase}
                onChange={(event) => setLikesBase(Number(event.target.value))}
              />

              <label htmlFor="level-bias">Level bias: {levelBias}</label>
              <input
                id="level-bias"
                type="range"
                min={0}
                max={6}
                step={1}
                value={levelBias}
                onChange={(event) => setLevelBias(Number(event.target.value))}
              />

              <label htmlFor="points-base">Points base: {pointsBase}</label>
              <input
                id="points-base"
                type="range"
                min={40}
                max={320}
                step={10}
                value={pointsBase}
                onChange={(event) => setPointsBase(Number(event.target.value))}
              />
            </div>
          ) : null}

          <div className="table-wrap">
            <p className="table-caption">
              Generated datasource rows (raw, unfiltered): <strong>{mockRows.length}</strong>
            </p>
            <p className="table-caption">
              Result Payload rows: <strong>{postsRequested ? servedIds.size : 0}</strong>
              {' '}
              {postsRequested
                ? '(rows included by current query args are highlighted in green)'
                : '(query currently does not request posts)'}
            </p>
            <table>
              <thead>
                <tr>
                  <th>name</th>
                  <th>role</th>
                  <th>level</th>
                  <th>points</th>
                  <th>post.id</th>
                  <th>post.title</th>
                  <th>post.likes</th>
                  <th>post.published</th>
                </tr>
              </thead>
              <tbody>
                {mockRows.map((row) => (
                  <tr
                    key={row.id}
                    className={postsRequested && servedIds.has(row.id) ? 'in-payload' : 'out-payload'}
                  >
                    <td>{row.name}</td>
                    <td>{row.role}</td>
                    <td>{row.level}</td>
                    <td>{row.points}</td>
                    <td>{row.id}</td>
                    <td>{row.title}</td>
                    <td>{row.likes}</td>
                    <td>{String(row.published)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel output-panel">
          <div className="panel-head">
            <h3>Result Payload</h3>
            <p>{selectedCount} fields selected · {payloadSize} bytes</p>
          </div>
          <pre>{result.error ? `Error: ${result.error}` : JSON.stringify(result.data, null, 2)}</pre>
        </article>
      </section>
    </main>
  )
}

export default App
