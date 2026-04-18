#!/bin/bash
docker logs prevencao-maxvale-backend --tail 300 2>&1 | grep -iE 'finaliz|fin_' | tail -15
