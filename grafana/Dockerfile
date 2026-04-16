# Specific Versioning would be better
FROM grafana/grafana

USER root

# Copy provisioning
COPY provisioning/ /etc/grafana/provisioning/
# grafana user is UID 472, primary group is 0 (root) - no "grafana" group exists
RUN chown -R 472:0 /etc/grafana/provisioning/

USER grafana

# Copy custom grafana.ini if you have one
COPY grafana.ini /etc/grafana/grafana.ini

# Copy entrypoint
COPY --chmod=755 entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]