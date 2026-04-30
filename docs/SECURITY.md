# Security Policy

## Supported Versions

Currently, only the latest version of Space Analyzer is supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

### How to Report

**Do not** open a public issue for security vulnerabilities.

Instead, please send an email to the project maintainers with:
- A description of the vulnerability
- Steps to reproduce the vulnerability
- Any potential impact
- If available, a suggested fix or mitigation

### What to Expect

- We will acknowledge receipt of your report within 48 hours
- We will provide a detailed response within 7 days
- We will work with you to understand and resolve the issue
- Once resolved, we will announce the security fix

## Security Best Practices

### For Users

1. **Keep dependencies updated**: Regularly run `npm audit` and update dependencies
2. **Use environment variables**: Never commit sensitive data like API keys
3. **Review `.env.example`**: Use the provided template for configuration
4. **Scan for vulnerabilities**: Use tools like `npm audit` or `snyk`
5. **Keep your system updated**: Ensure your OS and Node.js are up to date

### For Developers

1. **Never commit secrets**: API keys, passwords, and tokens should never be in the codebase
2. **Use `.env` files**: Keep sensitive configuration in environment variables
3. **Validate input**: Always validate and sanitize user input
4. **Use HTTPS**: Always use secure connections for API calls
5. **Follow principle of least privilege**: Minimize permissions and access

## Known Security Considerations

### API Keys

This project may use external AI services (Google Gemini, Ollama). These require API keys that should:
- Never be committed to version control
- Be stored in environment variables
- Be rotated regularly
- Have limited scope and permissions

### File System Access

The application analyzes local file systems. Ensure:
- Only scan directories you have permission to access
- Be aware of what data is being sent to external AI services
- Review privacy policies of external services used

### Network Communication

The application may communicate with:
- Local Ollama server (localhost:11434)
- External AI APIs (Google Gemini)
- Development servers

Ensure your network is secure and review what data is being transmitted.

## Dependency Security

We regularly audit dependencies for known vulnerabilities. To check your local installation:

```bash
npm audit
npm audit fix
```

## Security Updates

When security vulnerabilities are discovered:
1. We will assess the severity and impact
2. We will develop a fix
3. We will release a security update
4. We will announce the update with details

## Contact

For security-related questions or to report vulnerabilities, please contact the project maintainers through the appropriate channels.
