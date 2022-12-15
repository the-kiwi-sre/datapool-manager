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

# Output URLs to use in the browser
print "****************************************"
kubectl get services -n dpm | perl -lne 'print "DATAPOOL MANAGER: http://${1}/DPM/STATUS" if /(\S+\.com)/'
kubectl get services -n prometheus | perl -lne 'print "PROMETHEUS: http://${1}" if /(\S+\.com)/'
print "****************************************"
