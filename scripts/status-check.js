import http from 'http';
import { spawn } from 'child_process';

class StatusChecker {
  constructor() {
    this.services = [
      { name: 'Backend', port: 8080, path: '/api/health' },
      { name: 'Frontend', port: 5173, path: '/' }
    ];
  }

  async checkService(service) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: service.port,
        path: service.path,
        method: 'GET',
        timeout: 2000
      }, (res) => {
        resolve({
          name: service.name,
          status: res.statusCode === 200 ? '✅ Running' : '⚠️ Error',
          port: service.port,
          statusCode: res.statusCode
        });
      });
      
      req.on('error', () => {
        resolve({
          name: service.name,
          status: '❌ Stopped',
          port: service.port,
          statusCode: null
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          name: service.name,
          status: '⏱️ Timeout',
          port: service.port,
          statusCode: null
        });
      });
      
      req.end();
    });
  }

  async checkProcesses() {
    return new Promise((resolve) => {
      const processes = [];
      
      // Check for Node.js processes
      const ps = spawn('tasklist', ['/fi', 'imagename eq node.exe', '/fo', 'csv'], {
        shell: true
      });
      
      let output = '';
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ps.on('close', () => {
        const lines = output.split('\n');
        const nodeProcesses = lines.filter(line => line.includes('node.exe')).length;
        
        resolve({
          nodeProcesses,
          totalProcesses: nodeProcesses
        });
      });
    });
  }

  async checkPorts() {
    return new Promise((resolve) => {
      const netstat = spawn('netstat', ['-an'], { shell: true });
      
      let output = '';
      netstat.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      netstat.on('close', () => {
        const port8080 = output.includes(':8080') && output.includes('LISTENING');
        const port5173 = output.includes(':5173') && output.includes('LISTENING');
        
        resolve({
          port8080,
          port5173
        });
      });
    });
  }

  async run() {
    console.log('🔍 Space Analyzer Pro - Service Status Check\n');
    
    // Check services
    const serviceStatuses = await Promise.all(
      this.services.map(service => this.checkService(service))
    );
    
    // Check processes and ports
    const [processes, ports] = await Promise.all([
      this.checkProcesses(),
      this.checkPorts()
    ]);
    
    // Display results
    console.log('📊 Service Status:');
    serviceStatuses.forEach(service => {
      console.log(`   ${service.status.padEnd(12)} ${service.name} (port ${service.port})`);
    });
    
    console.log('\n💻 System Info:');
    console.log(`   Node.js processes: ${processes.nodeProcesses}`);
    console.log(`   Port 8080 listening: ${ports.port8080 ? '✅' : '❌'}`);
    console.log(`   Port 5173 listening: ${ports.port5173 ? '✅' : '❌'}`);
    
    // Overall status
    const allRunning = serviceStatuses.every(s => s.status === '✅ Running');
    console.log(`\n${allRunning ? '✅' : '⚠️'} Overall Status: ${allRunning ? 'All services running' : 'Some services may be down'}`);
    
    // Quick actions
    console.log('\n🚀 Quick Actions:');
    console.log('   npm run start     - Start all services');
    console.log('   npm run server    - Start backend only');
    console.log('   npm run dev       - Start frontend only');
    console.log('   npm run status    - Check this status again');
  }
}

// Run the status check
new StatusChecker().run().catch(console.error);
