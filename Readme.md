## Bitcoin trading Bitcoin

Automated bitcoin trading bot.

Blog Link: 

## Installation Instructions

#### Dev Setup<a name="dev_setup"></a>

- The node version required for this project is at least v8.9.4+ LTS. (nvm- short for node version manage is great if you need to run multiple node versions)
- Dependencies should be installed with `npm install`
    - You will need `pm2` for managing bot processes (`npm install -g pm2`)
    - One of the node dependencies `tulind` indicator needs to compile C binaries - if `npm install` failes for that module you can build directly with `npm install tulind --build-from-source`. This will require you to ensure you have `g++` installed on your system.
- Ensure you have elasticsearch and kibana running on your localhost. Alternatively you can install it on an aws ec2 (recommended for serious users). Official installation guide can be found  <a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/_installation.html" target="_blank">here</a>.
- Configure elasticsearch port on `config.json`. Default elasticsearch port is already configured on the project repo. Run the following commands to run ingest cron and position taking crons respectively. We will discuss what each does in next section.
    - `npm run ingest`
    - `npm run takeposition`
