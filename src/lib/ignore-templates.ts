export const IGNORE_TEMPLATES: Record<string, string> = {
    'Node.js': 'node_modules/\ndist/\nbuild/\n.next/\n.svelte-kit/\n*.log\nnpm-debug.log*\ncoverage/\n',
    Python: '__pycache__/\n*.py[cod]\n.venv/\nvenv/\n*.egg-info/\n.pytest_cache/\n.mypy_cache/\n',
    Rust: 'target/\n**/*.rs.bk\n',
    Go: 'bin/\n*.exe\n*.test\n*.out\nvendor/\n',
    Java: '*.class\n*.jar\ntarget/\nbuild/\n.gradle/\n',
    'Secrets & env': '.env\n.env.*\n!.env.example\n*.pem\n*.key\n',
    'Editors & OS': '.idea/\n.vscode/\n*.swp\n*~\n.DS_Store\nThumbs.db\n'
};
