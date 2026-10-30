import jenkins.model.Jenkins

def jenkins = Jenkins.get()
jenkins.setNumExecutors(0)
jenkins.save()