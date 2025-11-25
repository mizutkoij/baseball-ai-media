# Baseball Data Collection Project - Lessons Learned

## What We Attempted
- Comprehensive Japanese NPB (baseball) data collection system
- Integration of Yahoo Live data + BaseballData.jp detailed analytics
- Real-time collection with 30-second intervals
- Advanced metrics (VDUCP, conditional stats) via Playwright browser automation

## What Went Wrong

### Technical Issues
1. **Playwright Overkill**: Used full browser automation for simple HTTP scraping
   - Memory usage: ~500MB+ per browser instance
   - CPU intensive headless Chrome processes
   - Didn't terminate cleanly, causing memory leaks

2. **Process Multiplication Bug**: 
   - `monitoring-actions.ts` spawned 10+ duplicate processes
   - Each consuming 60-70MB RAM
   - Should have been 1 process, became 700MB+ total

3. **Resource Competition**:
   - Total memory usage: 14GB out of 15GB available
   - EPGStation (recording system) was starved of resources
   - OOM killer terminated EPGStation processes

4. **Wrong Server Choice**:
   - Used production recording server instead of dedicated VPS
   - Mixed critical recording infrastructure with experimental data collection

### Design Flaws
1. **Over-engineering**: Complex browser automation for simple data extraction
2. **No resource limits**: systemd services had no memory/CPU caps
3. **Poor process management**: No cleanup mechanisms for stuck processes
4. **Insufficient testing**: Didn't test resource usage under production load

## What We Should Have Done

### Architecture
- **Separate VPS**: $5/month VPS for data collection, not recording server
- **Simple HTTP requests**: Basic requests/BeautifulSoup instead of Playwright
- **Lightweight tools**: Python requests + pandas, not Node.js + browser automation
- **Manual reverse engineering**: Study site structure before coding

### Implementation  
- **Resource limits**: Memory/CPU caps on all services
- **Process monitoring**: Automatic cleanup of stuck processes  
- **Graceful degradation**: Fall back to basic collection if advanced fails
- **Incremental deployment**: Start with minimal viable product

### Operations
- **Proper testing environment**: Test resource usage before production
- **Monitoring**: Memory/CPU alerts before system saturation
- **Rollback plan**: Quick way to disable all collection if issues arise

## Technical Learnings

### Good Parts We Can Reuse
- **PoliteHttp class**: Rate limiting and robots.txt compliance
- **Discord integration**: CSV notifications worked well  
- **systemd integration**: Timer scheduling concept was sound
- **Data structure design**: CSV output format was appropriate

### Code Quality Issues
- **AI-generated code limitations**: GPT code needs human review and testing
- **Insufficient error handling**: No graceful failures when resources exhausted
- **Process lifecycle**: Didn't properly manage browser process cleanup
- **Resource awareness**: No monitoring of memory/CPU usage during development

## Future Approach

### For Data Collection Projects
1. **Start simple**: Basic HTTP scraping first, add complexity only if needed
2. **Dedicated infrastructure**: Never run experiments on production systems
3. **Resource budgeting**: Define memory/CPU limits upfront
4. **Gradual scaling**: Add one feature at a time with resource monitoring

### For AI-Assisted Development
1. **Human oversight**: Always review and test AI-generated code thoroughly
2. **Resource testing**: Test memory/CPU usage before deployment
3. **Incremental approach**: Build and test small components first
4. **Domain expertise**: Understand the target system before automating

## Apologies and Thanks
- **To EPGStation**: Sorry for disrupting your recording system
- **To watora**: Thank you for the direct feedback and system expertise  
- **Learning experience**: Both sides learned valuable lessons about proper development practices

## Next Steps (If Continuing)
1. **Get dedicated VPS**: $5/month DigitalOcean/Vultr instance
2. **Manual site analysis**: Reverse engineer BaseballData.jp structure by hand
3. **Simple prototype**: Basic HTTP requests + BeautifulSoup proof of concept
4. **Resource monitoring**: Implement memory/CPU monitoring from day one
5. **Gradual deployment**: Start with 1 page/hour, scale gradually

---

**Date**: August 15, 2025  
**Duration**: 1 day of development, 30 minutes of crisis resolution  
**Key takeaway**: "The most sophisticated solution isn't always the right solution"