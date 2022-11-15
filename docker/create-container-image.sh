# Clone the public repo of Datapool Manager
git clone https://github.com/the-kiwi-sre/datapool-manager.git

# Copy our Dockerfile into our cloned repo
cp Dockerfile datapool-manager/.

# Copy our Datapool Manager config file into a cloned repo
cp config.json datapool-manager/.

# Navigate into the repo folder
cd datapool-manager

# Install the required dependencies / modules
npm install

# Build the Docker image
docker build --network host --rm -t thekiwisre/datapool-manager .

# Head back out to the parent folder
cd ..

# run npm install to get dependencies / modules
rm -rf datapool-manager
