#!/bin/bash
# deploy.sh
# Baseball AI Media - Deployment Script

echo "🚀 Baseball AI Media - Deployment Script"
echo "========================================"

# プロジェクト情報
PROJECT_NAME="baseball-ai-media"
API_SERVER="100.88.12.26"
API_PORT="8000"

# Git repository 確認
if [ ! -d ".git" ]; then
    echo "📝 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Phase 5 MVP"
    
    echo "🔗 Please create a GitHub repository and run:"
    echo "git remote add origin [your-github-repo-url]"
    echo "git push -u origin main"
    echo ""
    read -p "Press Enter after creating GitHub repository..."
fi

# フロントエンド依存関係インストール
echo "📦 Installing frontend dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi

# ビルドテスト
echo "🔨 Testing build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed - please fix errors before deploying"
    exit 1
fi

echo "✅ Build successful!"

# 環境変数確認
echo "🔧 Checking environment variables..."
if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then
    echo "⚠️  NEXT_PUBLIC_API_BASE_URL not set"
    echo ""
    echo "🔧 Using IP-based API for private deployment:"
    echo "  API URL: http://${API_SERVER}:${API_PORT}/api"
    export NEXT_PUBLIC_API_BASE_URL="http://${API_SERVER}:${API_PORT}/api"
fi

echo "📊 Environment:"
echo "  - API Base URL: $NEXT_PUBLIC_API_BASE_URL"
echo "  - Node Environment: ${NODE_ENV:-development}"

# API サーバー接続テスト
echo "🌐 Testing API server connection..."
curl -s "$NEXT_PUBLIC_API_BASE_URL/health" > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ API server is responding"
else
    echo "⚠️  API server not responding at $NEXT_PUBLIC_API_BASE_URL"
    echo "Make sure the FastAPI server is running on $API_SERVER:$API_PORT"
    echo ""
    echo "To start the API server, run on $API_SERVER:"
    echo "  cd /path/to/api"
    echo "  ./start_api.sh"
    echo ""
    read -p "Continue with deployment? (y/N): " continue_deploy
    if [[ ! $continue_deploy =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Vercel CLI 확인
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Vercel 배포
echo "🚀 Deploying to Vercel..."
echo ""
echo "📋 Deployment checklist:"
echo "  1. Make sure API server is running on $API_SERVER:$API_PORT"
echo "  2. Set environment variables in Vercel dashboard:"
echo "     - NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL"
echo "     - NEXT_PUBLIC_SITE_NAME=Baseball AI Media"
echo "  3. Configure custom domain if needed"
echo ""

read -p "Ready to deploy? (y/N): " ready_deploy

if [[ $ready_deploy =~ ^[Yy]$ ]]; then
    # Production 배포
    echo "🌟 Deploying to production..."
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Deployment successful!"
        echo ""
        echo "📱 Your site is now live!"
        echo "📊 Don't forget to set environment variables in Vercel dashboard"
        echo "🔔 API server must be running on $API_SERVER:$API_PORT"
        echo ""
        echo "🔗 Useful links:"
        echo "  - Vercel Dashboard: https://vercel.com/dashboard"
        echo "  - API Health Check: $NEXT_PUBLIC_API_BASE_URL/health"
        echo "  - API Documentation: $NEXT_PUBLIC_API_BASE_URL/docs"
    else
        echo "❌ Deployment failed"
        exit 1
    fi
else
    echo "📋 To deploy manually:"
    echo "  vercel --prod"
fi

echo ""
echo "✅ Deployment script completed!"