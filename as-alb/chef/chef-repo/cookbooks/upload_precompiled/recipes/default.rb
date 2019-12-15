#
# Cookbook:: install_mastodon
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

user_data = node['user']
server_data = node['server']
package_data = server_data['package']

fqdn = server_data['federation']['local_domain']
home = user_data['home']

execute "packaging" do
    user        "root"
    command <<-EOL
        cd #{home}
        tar cfz #{package_data['package_name']} #{fqdn}
    EOL
    action :run
end

execute "upload" do
    user        "root"
    command <<-EOL
        aws s3 cp #{home}/#{package_data['package_name']} \
            s3://#{package_data['s3_bucket']}/#{package_data['s3_prefix']}/#{package_data['package_name']}
    EOL
    action :run
end
