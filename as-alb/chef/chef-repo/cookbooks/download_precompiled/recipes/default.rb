#
# Cookbook:: download_precompiled
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

user_data = node['user']
server_data = node['server']

package_data = server_data['package']
fqdn = server_data['federation']['local_domain']
home = user_data['home']

user = 'mastodon'
group = 'mastodon'

execute "download" do
    user        "root"
    command <<-EOL
        aws s3 cp  \
            s3://#{package_data['s3_bucket']}/#{package_data['s3_prefix']}/#{package_data['package_name']} \
            #{home}/../#{package_data['package_name']}
    EOL
    action :run
end

execute "extract" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} bash -c "cd #{home}/.. && tar xfz #{package_data['package_name']}"
    EOL
    action :run
end
