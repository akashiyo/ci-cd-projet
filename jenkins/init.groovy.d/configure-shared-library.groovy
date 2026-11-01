import jenkins.model.Jenkins
import jenkins.plugins.git.GitSCMSource
import org.jenkinsci.plugins.workflow.libs.GlobalLibraries
import org.jenkinsci.plugins.workflow.libs.LibraryConfiguration
import org.jenkinsci.plugins.workflow.libs.SCMSourceRetriever

Jenkins jenkins = Jenkins.get()
GlobalLibraries globalLibraries = GlobalLibraries.get()
String libraryName = 'book-catalog-shared'
LibraryConfiguration library = globalLibraries.libraries.find { it.name == libraryName }
List<LibraryConfiguration> libraries = new ArrayList<>(globalLibraries.libraries)

if (library == null) {
    library = new LibraryConfiguration(
        libraryName,
        new SCMSourceRetriever(new GitSCMSource(
            'book-catalog-shared',
            'https://github.com/akashiyo/ci-cd-projet.git',
            '',
            '*',
            '',
            false
        ))
    )
    libraries.add(library)
}

library.defaultVersion = 'v1.0.0'
library.implicit = false
library.allowVersionOverride = true
globalLibraries.setLibraries(libraries)
globalLibraries.save()
jenkins.save()
