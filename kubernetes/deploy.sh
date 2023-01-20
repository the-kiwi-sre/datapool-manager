# Prior to running this script you need to set your AWS credentials!

# Deploy our EKS cluster
eksctl create cluster --name dpm --region ap-southeast-2

# Create a namespace for the Datapool Manager app
kubectl create namespace dpm

# Deploy Datapool Manager
kubectl apply -f ./kubernetes/dpm-manifest.yaml

# Create a namespace for Prometheus
kubectl create namespace prometheus

# Deploy Prometheus
helm upgrade -i prometheus prometheus-community/kube-prometheus-stack --namespace prometheus

# Deploy a service to expose Prometheus to the internet
kubectl apply -f kubernetes/prometheus-lb.yaml

# Deploy our custom Prometheus instance that scrapes our app /metrics endpoint
kubectl apply -f kubernetes/prometheus.yaml

# Wait 10 seconds for the services to create
sleep 10

# Output URLs to use in the browser
echo "****************************************"
kubectl get services -n dpm | perl -lne 'print "DATAPOOL MANAGER: http://${1}/DPM/STATUS" if /datapool-manager-service\s+\S+\s+\S+\s+(\S+\.com)/'

kubectl get services -n prometheus | perl -lne 'print "CLUSTER PROMETHEUS: http://${1}" if /prometheus-external-service\s+\S+\s+\S+\s+(\S+\.com)/'

kubectl get services -n dpm | perl -lne 'print "CUSTOM PROMETHEUS: http://${1}" if /prometheus-service\s+\S+\s+\S+\s+(\S+\.com)/'
echo "****************************************"
