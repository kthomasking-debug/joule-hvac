# Vercel Deployment Configuration

Complete Vercel deployment setup with error handling for Joule HVAC app.

## Files Created

### 1. `vercel.json`
Vercel deployment configuration:
- SPA routing (all routes → index.html)
- Cache headers for static assets
- Security headers
- Function timeout settings

### 2. `src/utils/vercelErrorHandler.js`
Utility for handling Vercel-specific errors:
- Maps Vercel error codes to user-friendly messages
- Provides actionable error messages
- Handles both application and platform errors

### 3. Enhanced `ErrorBoundary.jsx`
- Detects Vercel errors automatically
- Shows user-friendly error messages
- Displays error codes for debugging

## Deployment

### Quick Deploy

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Production deploy**:
   ```bash
   vercel --prod
   ```

### Environment Variables

Set in Vercel dashboard or via CLI:
```bash
vercel env add VITE_GROQ_API_KEY
vercel env add NODE_ENV production
```

## Error Handling

The app now automatically handles Vercel errors:

- **502 errors**: "Server temporarily unavailable"
- **500 errors**: "Internal server error"
- **404 errors**: "Resource not found"
- **Function timeouts**: "Request took too long"
- **Throttling**: "Too many requests"

All errors show user-friendly messages with suggested actions.

## Common Vercel Errors & Solutions

| Error Code | Solution |
|------------|----------|
| `FUNCTION_INVOCATION_TIMEOUT` | Reduce query complexity or increase timeout |
| `FUNCTION_PAYLOAD_TOO_LARGE` | Reduce data being sent |
| `FUNCTION_THROTTLED` | Wait and retry |
| `DEPLOYMENT_NOT_FOUND` | Check deployment URL |
| `DEPLOYMENT_PAUSED` | Resume in Vercel dashboard |

## Testing

Test error handling locally:
```bash
# Simulate Vercel error
curl -H "x-vercel-error: FUNCTION_INVOCATION_TIMEOUT" http://localhost:5173
```

## Monitoring

Check Vercel dashboard for:
- Function invocations
- Error rates
- Response times
- Deployment status

## Next Steps

1. Deploy to Vercel
2. Monitor error logs
3. Adjust function timeouts if needed
4. Set up error alerts in Vercel dashboard






