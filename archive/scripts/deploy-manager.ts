#!/usr/bin/env npx tsx
/**
 * NPB Live Prediction System - Deployment Manager
 * 
 * Easy production configuration and deployment management
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

interface DeployConfig {
  environment: string;
  description: string;
  services: {
    live: {
      port: number;
      dataDir: string;
      logLevel: string;
      nodeEnv: string;
    };
    metrics: {
      port: number;
      logLevel: string;
    };
  };
  parameters: {
    configFile: string;
    tuningDays: number;
    autoTune: boolean;
  };
  monitoring: {
    enabled: boolean;
    alerting: boolean;
    healthCheckInterval: number;
  };
}

const CONFIGS: Record<string, DeployConfig> = {
  development: {
    environment: "development",
    description: "Development environment with debug logging",
    services: {
      live: {
        port: 8787,
        dataDir: "data",
        logLevel: "debug",
        nodeEnv: "development"
      },
      metrics: {
        port: 9465,
        logLevel: "debug"
      }
    },
    parameters: {
      configFile: "config/live-params.json",
      tuningDays: 7,
      autoTune: false
    },
    monitoring: {
      enabled: true,
      alerting: false,
      healthCheckInterval: 30
    }
  },

  staging: {
    environment: "staging",
    description: "Staging environment for testing before production",
    services: {
      live: {
        port: 8787,
        dataDir: "/opt/npb/data",
        logLevel: "info",
        nodeEnv: "staging"
      },
      metrics: {
        port: 9465,
        logLevel: "info"
      }
    },
    parameters: {
      configFile: "config/live-params.json",
      tuningDays: 14,
      autoTune: true
    },
    monitoring: {
      enabled: true,
      alerting: false,
      healthCheckInterval: 15
    }
  },

  production: {
    environment: "production",
    description: "Production environment with full monitoring",
    services: {
      live: {
        port: 8787,
        dataDir: "/opt/npb/data",
        logLevel: "info",
        nodeEnv: "production"
      },
      metrics: {
        port: 9465,
        logLevel: "warn"
      }
    },
    parameters: {
      configFile: "config/live-params.json",
      tuningDays: 21,
      autoTune: true
    },
    monitoring: {
      enabled: true,
      alerting: true,
      healthCheckInterval: 10
    }
  }
};

async function executeCommand(command: string, args: string[] = []): Promise<{stdout: string, stderr: string, exitCode: number}> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });
  });
}

async function generateSystemdService(config: DeployConfig, serviceType: 'live' | 'metrics'): Promise<string> {
  const serviceName = serviceType === 'live' ? 'npb-live' : 'npb-metrics';
  const description = serviceType === 'live' ? 'NPB Live Prediction API Server' : 'NPB Metrics Collection Server';
  const serviceConfig = config.services[serviceType];
  
  const envVars = [
    `Environment=NODE_ENV=${config.services.live.nodeEnv}`,
    `Environment=LOG_LEVEL=${serviceConfig.logLevel}`,
    `Environment=DATA_DIR=${config.services.live.dataDir}`
  ];
  
  if (serviceType === 'live') {
    envVars.push(`Environment=PORT=${serviceConfig.port}`);
  } else {
    envVars.push(`Environment=METRICS_PORT=${serviceConfig.port}`);
  }
  
  const execStart = serviceType === 'live' 
    ? '/usr/bin/node server/live-api.js'
    : '/usr/bin/npm run metrics';
  
  return `[Unit]
Description=${description}
After=network.target
Wants=network.target

[Service]
Type=simple
User=npb
Group=npb
WorkingDirectory=/opt/npb/baseball-ai-media
${envVars.join('\n')}
ExecStart=${execStart}
Restart=always
RestartSec=${serviceType === 'live' ? '10' : '15'}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${serviceName}

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${config.services.live.dataDir}
ReadOnlyPaths=/opt/npb/baseball-ai-media

# Resource limits
LimitNOFILE=65536
MemoryMax=${serviceType === 'live' ? '1G' : '512M'}
CPUQuota=${serviceType === 'live' ? '200%' : '100%'}

[Install]
WantedBy=multi-user.target`;
}

async function deployEnvironment(envName: string, dryRun: boolean = false): Promise<void> {
  const config = CONFIGS[envName];
  if (!config) {
    throw new Error(`Unknown environment: ${envName}`);
  }
  
  console.log(`🚀 Deploying ${config.environment} environment`);
  console.log(`📝 ${config.description}`);
  
  if (dryRun) {
    console.log(`⚠️  DRY RUN MODE - No changes will be made`);
  }
  
  // Generate systemd service files
  console.log('\n📄 Generating systemd service files...');
  const liveService = await generateSystemdService(config, 'live');
  const metricsService = await generateSystemdService(config, 'metrics');
  
  if (!dryRun) {
    await fs.mkdir('deploy/generated', { recursive: true });
    await fs.writeFile(`deploy/generated/npb-live-${envName}.service`, liveService);
    await fs.writeFile(`deploy/generated/npb-metrics-${envName}.service`, metricsService);
    console.log(`✅ Service files written to deploy/generated/`);
  } else {
    console.log(`   [DRY RUN] Would write service files for ${envName}`);
  }
  
  // Update configuration
  console.log('\n⚙️ Updating configuration...');
  if (!dryRun) {
    const configPath = config.parameters.configFile;
    try {
      const existingConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      console.log(`✅ Using existing parameters from ${configPath}`);
      
      // Add environment-specific overrides if needed
      existingConfig._environment = envName;
      existingConfig._generated = new Date().toISOString();
      
      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
    } catch (error) {
      console.log(`⚠️  Could not read existing config: ${error.message}`);
    }
  } else {
    console.log(`   [DRY RUN] Would update configuration for ${envName}`);
  }
  
  // Auto-tune parameters if enabled
  if (config.parameters.autoTune) {
    console.log('\n🎯 Auto-tuning parameters...');
    if (!dryRun) {
      try {
        const tuneResult = await executeCommand('npx', ['tsx', 'scripts/tune_live.ts', config.parameters.tuningDays.toString()]);
        if (tuneResult.exitCode === 0) {
          console.log('✅ Parameter tuning completed successfully');
        } else {
          console.log(`⚠️  Parameter tuning failed: ${tuneResult.stderr}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not run parameter tuning: ${error.message}`);
      }
    } else {
      console.log(`   [DRY RUN] Would run parameter tuning with ${config.parameters.tuningDays} days of data`);
    }
  }
  
  // Generate deployment summary
  console.log('\n📋 Deployment Summary');
  console.log('=====================');
  console.log(`Environment: ${config.environment}`);
  console.log(`Live API Port: ${config.services.live.port}`);
  console.log(`Metrics Port: ${config.services.metrics.port}`);
  console.log(`Data Directory: ${config.services.live.dataDir}`);
  console.log(`Log Level: ${config.services.live.logLevel}`);
  console.log(`Monitoring: ${config.monitoring.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Alerting: ${config.monitoring.alerting ? 'Enabled' : 'Disabled'}`);
  
  if (!dryRun) {
    console.log('\n🔧 Next Steps:');
    console.log('1. Review generated service files in deploy/generated/');
    console.log('2. Install services: sudo cp deploy/generated/*.service /etc/systemd/system/');
    console.log('3. Reload systemd: sudo systemctl daemon-reload');
    console.log('4. Enable services: sudo systemctl enable npb-live npb-metrics');
    console.log('5. Start services: sudo systemctl start npb-live npb-metrics');
    console.log('6. Check status: sudo systemctl status npb-live');
  }
}

async function checkStatus(): Promise<void> {
  console.log('🔍 NPB Live Prediction System Status');
  console.log('====================================');
  
  // Check if services are running
  try {
    const liveStatus = await executeCommand('systemctl', ['is-active', 'npb-live']);
    const metricsStatus = await executeCommand('systemctl', ['is-active', 'npb-metrics']);
    
    console.log(`Live Service: ${liveStatus.stdout.trim() === 'active' ? '✅ Running' : '❌ Not running'}`);
    console.log(`Metrics Service: ${metricsStatus.stdout.trim() === 'active' ? '✅ Running' : '❌ Not running'}`);
  } catch (error) {
    console.log('⚠️  Could not check systemd services (may not be installed)');
  }
  
  // Check endpoints
  try {
    const healthCheck = await executeCommand('curl', ['-s', 'http://localhost:8787/health']);
    if (healthCheck.exitCode === 0) {
      const health = JSON.parse(healthCheck.stdout);
      console.log(`Health Endpoint: ${health.ok ? '✅ OK' : '❌ Not OK'}`);
    } else {
      console.log('Health Endpoint: ❌ Not responding');
    }
  } catch (error) {
    console.log('Health Endpoint: ❌ Not accessible');
  }
  
  try {
    const metricsCheck = await executeCommand('curl', ['-s', 'http://localhost:9465/metrics']);
    console.log(`Metrics Endpoint: ${metricsCheck.exitCode === 0 ? '✅ OK' : '❌ Not responding'}`);
  } catch (error) {
    console.log('Metrics Endpoint: ❌ Not accessible');
  }
  
  // Check configuration
  try {
    const configExists = await fs.access('config/live-params.json');
    console.log('Configuration: ✅ Present');
    
    const config = JSON.parse(await fs.readFile('config/live-params.json', 'utf-8'));
    if (config._environment) {
      console.log(`Environment: ${config._environment}`);
    }
    if (config._generated) {
      console.log(`Last Updated: ${new Date(config._generated).toLocaleString()}`);
    }
  } catch (error) {
    console.log('Configuration: ❌ Missing or invalid');
  }
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  try {
    switch (command) {
      case 'deploy':
        const environment = args[0];
        const dryRun = args.includes('--dry-run');
        
        if (!environment) {
          console.log('Available environments:');
          Object.entries(CONFIGS).forEach(([name, config]) => {
            console.log(`  ${name}: ${config.description}`);
          });
          console.log('\nUsage: npx tsx scripts/deploy-manager.ts deploy <environment> [--dry-run]');
          process.exit(1);
        }
        
        await deployEnvironment(environment, dryRun);
        break;
        
      case 'status':
        await checkStatus();
        break;
        
      case 'list':
        console.log('Available environments:');
        Object.entries(CONFIGS).forEach(([name, config]) => {
          console.log(`\n${name}:`);
          console.log(`  Description: ${config.description}`);
          console.log(`  Live Port: ${config.services.live.port}`);
          console.log(`  Metrics Port: ${config.services.metrics.port}`);
          console.log(`  Data Dir: ${config.services.live.dataDir}`);
          console.log(`  Auto-tune: ${config.parameters.autoTune ? 'Yes' : 'No'}`);
          console.log(`  Monitoring: ${config.monitoring.enabled ? 'Yes' : 'No'}`);
        });
        break;
        
      default:
        console.log('NPB Live Prediction System - Deployment Manager');
        console.log('');
        console.log('Commands:');
        console.log('  deploy <env> [--dry-run]  Deploy to specified environment');
        console.log('  status                    Check system status');
        console.log('  list                      List available environments');
        console.log('');
        console.log('Examples:');
        console.log('  npx tsx scripts/deploy-manager.ts deploy production');
        console.log('  npx tsx scripts/deploy-manager.ts deploy staging --dry-run');
        console.log('  npx tsx scripts/deploy-manager.ts status');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Deployment manager failed:', error);
    process.exit(1);
  });
}