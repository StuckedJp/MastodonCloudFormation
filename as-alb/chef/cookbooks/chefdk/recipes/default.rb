# install wget
package "wget" do
  action :install
end

# Download Chefdk
# url = 'https://packages.chef.io/files/stable/chefdk/4.6.35/ubuntu/18.04/chefdk_4.6.35-1_amd64.deb'
url = 'https://packages.chef.io/files/stable/chefdk/1.6.11/ubuntu/16.04/chefdk_1.6.11-1_amd64.deb'
execute 'download_chefdk' do
  command "wget #{url}"
  user    'vagrant'
  cwd     '/tmp'
end

# install
execute 'install_chefdk' do
  command "dpkg -i /tmp/#{File.basename(url)}"
  user    'root'
end
